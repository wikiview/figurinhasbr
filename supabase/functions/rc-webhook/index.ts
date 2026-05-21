// Supabase Edge Function: rc-webhook
// =====================================================================
// Receives RevenueCat webhook events and mirrors the premium entitlement
// onto `public.profiles.is_premium`. This is the anti-tampering source
// of truth: the client never writes `is_premium` directly anymore — it
// only reads it. RC pushes purchase/renewal/expiration events here, and
// this function updates the row using the SERVICE ROLE key (which
// bypasses RLS and the BEFORE UPDATE trigger guard).
//
// Authentication model
// --------------------
// RC does NOT send a Supabase JWT. Instead, we configure a shared secret
// in the RC dashboard (Project → Integrations → Webhooks → "Authorization
// header value"), and RC sends it back verbatim in the `Authorization`
// header of every request. We compare it against the `RC_WEBHOOK_AUTH_TOKEN`
// secret using constant-time comparison to defeat timing side-channels.
//
// Idempotency
// -----------
// All operations are idempotent UPDATEs keyed by user id. RC retries
// failed deliveries, so duplicate events are safe.
//
// Deploy
// ------
//   supabase functions deploy rc-webhook --no-verify-jwt
//   supabase secrets set RC_WEBHOOK_AUTH_TOKEN=<openssl rand -hex 32>
//
// Configure in RC dashboard
// -------------------------
//   URL:        https://<your-project-ref>.supabase.co/functions/v1/rc-webhook
//   Auth header value: the same secret stored as RC_WEBHOOK_AUTH_TOKEN
//
// See docs/payments-setup.md → Fase 6 for full instructions.

// @ts-ignore — Deno URL import resolved at runtime by Supabase Edge runtime.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// ---------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------
// @ts-ignore — Deno globals available at runtime.
const SUPABASE_URL: string | undefined = Deno.env.get('SUPABASE_URL');
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY: string | undefined = Deno.env.get(
  'SUPABASE_SERVICE_ROLE_KEY',
);
// @ts-ignore
const RC_WEBHOOK_AUTH_TOKEN: string | undefined = Deno.env.get(
  'RC_WEBHOOK_AUTH_TOKEN',
);

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------
const PREMIUM_ENTITLEMENT_ID = 'premium';

/** RC event types that GRANT premium (entitlement active). */
const GRANT_EVENT_TYPES = new Set<string>([
  'INITIAL_PURCHASE',
  'NON_RENEWING_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'TRANSFER',
]);

/** RC event types that REVOKE premium (definitive end of access). */
const REVOKE_EVENT_TYPES = new Set<string>(['EXPIRATION']);

/**
 * RC event types we acknowledge but treat as no-ops on `is_premium`.
 * - CANCELLATION / BILLING_ISSUE: user keeps access until period ends.
 *   RC will follow up with EXPIRATION when access truly stops.
 * - SUBSCRIBER_ALIAS: identity merge; nothing to mirror here.
 * - TEST: dashboard test event.
 */
const NOOP_EVENT_TYPES = new Set<string>([
  'CANCELLATION',
  'BILLING_ISSUE',
  'SUBSCRIBER_ALIAS',
  'TEST',
]);

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------
type RcEvent = {
  type?: string;
  app_user_id?: string;
  entitlement_ids?: string[] | null;
  // RC may also send `entitlement_id` (legacy, singular). We accept both.
  entitlement_id?: string | null;
  expiration_at_ms?: number | null;
};

type RcPayload = {
  event?: RcEvent;
  api_version?: string;
};

type Outcome =
  | { kind: 'grant' }
  | { kind: 'revoke' }
  | { kind: 'noop'; reason: string };

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/**
 * Constant-time comparison of two strings. Encodes both as UTF-8 bytes,
 * pads to equal length, then XORs every byte and ORs the result so the
 * function always touches every byte regardless of where the mismatch
 * occurs. Returns true only on exact match.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  // Compare against the longer length so length difference is also const-time.
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    const av = i < aBytes.length ? aBytes[i] : 0;
    const bv = i < bBytes.length ? bBytes[i] : 0;
    diff |= av ^ bv;
  }
  return diff === 0;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isUuid(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

function entitlementsOf(ev: RcEvent): string[] {
  if (Array.isArray(ev.entitlement_ids)) return ev.entitlement_ids;
  if (typeof ev.entitlement_id === 'string' && ev.entitlement_id.length > 0) {
    return [ev.entitlement_id];
  }
  return [];
}

function classify(ev: RcEvent): Outcome {
  const type = ev.type ?? '';
  const ents = entitlementsOf(ev);
  const touchesPremium = ents.includes(PREMIUM_ENTITLEMENT_ID);

  if (NOOP_EVENT_TYPES.has(type)) {
    return { kind: 'noop', reason: `event_type=${type}` };
  }
  if (GRANT_EVENT_TYPES.has(type)) {
    if (!touchesPremium) {
      return {
        kind: 'noop',
        reason: `grant event without '${PREMIUM_ENTITLEMENT_ID}' entitlement`,
      };
    }
    return { kind: 'grant' };
  }
  if (REVOKE_EVENT_TYPES.has(type)) {
    if (!touchesPremium) {
      return {
        kind: 'noop',
        reason: `revoke event without '${PREMIUM_ENTITLEMENT_ID}' entitlement`,
      };
    }
    return { kind: 'revoke' };
  }
  return { kind: 'noop', reason: `unknown event_type=${type}` };
}

// ---------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------

serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  // Env sanity. If the secret isn't configured, refuse — never default-open.
  if (!RC_WEBHOOK_AUTH_TOKEN) {
    console.error('[rc-webhook] RC_WEBHOOK_AUTH_TOKEN is not set; refusing');
    return json(500, { error: 'server_misconfigured' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[rc-webhook] missing SUPABASE_URL or SERVICE_ROLE_KEY');
    return json(500, { error: 'server_misconfigured' });
  }

  // Auth — RC sends our shared secret verbatim in the Authorization header.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader || !timingSafeEqual(authHeader, RC_WEBHOOK_AUTH_TOKEN)) {
    console.warn('[rc-webhook] auth rejected');
    return json(401, { error: 'unauthorized' });
  }

  // Parse payload.
  let payload: RcPayload;
  try {
    payload = (await req.json()) as RcPayload;
  } catch (e) {
    console.warn('[rc-webhook] malformed JSON', e);
    return json(400, { error: 'malformed_json' });
  }

  const event = payload?.event;
  if (!event || typeof event !== 'object') {
    return json(400, { error: 'missing_event' });
  }

  const eventType = event.type ?? 'UNKNOWN';
  const appUserId = event.app_user_id;

  // Always 200 on TEST so the RC dashboard "Send test event" button is green.
  if (eventType === 'TEST') {
    console.log('[rc-webhook] TEST event received', { app_user_id: appUserId });
    return json(200, { ok: true, test: true });
  }

  if (!appUserId || typeof appUserId !== 'string') {
    console.warn('[rc-webhook] missing app_user_id', { eventType });
    return json(400, { error: 'missing_app_user_id' });
  }

  const outcome = classify(event);

  // Log every event for observability, regardless of outcome.
  console.log('[rc-webhook] event', {
    type: eventType,
    app_user_id: appUserId,
    entitlements: entitlementsOf(event),
    expiration_at_ms: event.expiration_at_ms ?? null,
    outcome: outcome.kind,
  });

  if (outcome.kind === 'noop') {
    return json(200, { ok: true, skipped: outcome.reason });
  }

  // app_user_id must be the Supabase auth UUID. If it's not, the user wasn't
  // properly identified to RC — we can't mirror it. Return 200 to stop RC
  // retries (no amount of retrying will fix a non-UUID id).
  if (!isUuid(appUserId)) {
    console.warn('[rc-webhook] app_user_id is not a UUID, cannot mirror', {
      app_user_id: appUserId,
    });
    return json(200, { ok: true, skipped: 'non_uuid_app_user_id' });
  }

  const shouldBePremium = outcome.kind === 'grant';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ is_premium: shouldBePremium, updated_at: new Date().toISOString() })
    .eq('id', appUserId);

  if (updateErr) {
    console.error('[rc-webhook] profile update failed', {
      app_user_id: appUserId,
      message: updateErr.message,
    });
    // Return 500 so RC retries.
    return json(500, { error: 'db_update_failed' });
  }

  console.log('[rc-webhook] mirrored is_premium', {
    app_user_id: appUserId,
    is_premium: shouldBePremium,
    via: eventType,
  });

  return json(200, { ok: true });
});
