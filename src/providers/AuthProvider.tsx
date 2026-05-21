import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/src/lib/supabase';
import type { Profile } from '@/src/lib/types';
import {
  configurePurchases,
  getPremiumStatus,
  setPurchasesUserId,
} from '@/src/lib/purchases';

type AuthCtx = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  refreshPremiumStatus: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Mantém uma referência ao profile atual pra usar dentro de funções async
  // sem precisar reagir a mudanças (evita stale closure no refreshPremiumStatus).
  const profileRef = useRef<Profile | null>(null);
  const sessionRef = useRef<Session | null>(null);
  profileRef.current = profile;
  sessionRef.current = session;

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[auth] profile load error', error.message);
      setProfile(null);
      return;
    }
    setProfile(data as Profile | null);
  }

  async function refreshPremiumStatus() {
    const s = sessionRef.current;
    if (!s?.user.id) return;
    try {
      // Source of truth in-memory: RC SDK customerInfo. We call it so the
      // local UI flips to "Premium ativo" snappily after purchase, even
      // before the server-side mirror is updated.
      const status = await getPremiumStatus();

      // The server-side mirror (`profiles.is_premium`) is written EXCLUSIVELY
      // by the RC -> Supabase Edge Function webhook (`supabase/functions/rc-webhook`).
      // The client no longer writes `is_premium` — see docs/payments-setup.md
      // Fase 6 for the anti-tampering rationale. We re-read the profile and
      // only poll while DB and RC disagree — on a steady-state boot they
      // already agree and we exit immediately.
      await loadProfile(s.user.id);
      if (profileRef.current?.is_premium === status.isPremium) {
        return;
      }

      // Divergence: give the webhook a moment to land before giving up.
      const POLL_DELAYS_MS = [1500, 1500, 1500];
      let mirrored = false;
      for (let i = 0; i < POLL_DELAYS_MS.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_DELAYS_MS[i]));
        await loadProfile(s.user.id);
        const fresh = profileRef.current;
        if (fresh && fresh.is_premium === status.isPremium) {
          mirrored = true;
          break;
        }
      }
      if (!mirrored) {
        // Webhook hasn't caught up yet. Don't write — it eventually will.
        console.warn(
          '[auth] is_premium not mirrored yet (RC says %s, profile says %s); waiting on webhook',
          String(status.isPremium),
          String(profileRef.current?.is_premium),
        );
      }
    } catch (e) {
      console.warn('[auth] refreshPremiumStatus failed', e);
    }
  }

  useEffect(() => {
    let cancelled = false;

    // Cinto de segurança: jamais deixe o app preso no spinner inicial.
    // Cobre o cold-start raro em que getSession() / AsyncStorage não resolvem
    // (visto em RN quando o storage está bloqueado no boot).
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 8000);

    (async () => {
      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: Session | null } }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 5000),
          ),
        ]);
        if (cancelled) return;
        const s = sessionResult.data.session;
        setSession(s);
        sessionRef.current = s;
        try {
          await configurePurchases(s?.user.id ?? null);
        } catch (e) {
          console.warn('[auth] configurePurchases failed', e);
        }
        if (s?.user.id) {
          await loadProfile(s.user.id);
          void refreshPremiumStatus();
        }
      } catch (e) {
        console.warn('[auth] boot failed', e);
      } finally {
        if (!cancelled) setLoading(false);
        clearTimeout(safetyTimer);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      setSession(s);
      sessionRef.current = s;
      try {
        await setPurchasesUserId(s?.user.id ?? null);
      } catch (e) {
        console.warn('[auth] setPurchasesUserId failed', e);
      }
      if (s?.user.id) await loadProfile(s.user.id);
      else setProfile(null);
    });
    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        session,
        profile,
        loading,
        refreshProfile: async () => {
          if (session?.user.id) await loadProfile(session.user.id);
        },
        refreshPremiumStatus,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
