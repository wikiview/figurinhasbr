// Supabase Edge Function: generate-cover
// Recebe { selfie_base64, selfie_mime_type, team_code, team_name, variant? } do app,
// chama Gemini 2.5 Flash Image pra gerar a capa personalizada e salva no Storage
// `covers/{user_id}/cover-{timestamp}.png`.
//
// Variantes:
//   - 'standard' (default): capa com a camisa do time, gated por Premium (validado no client).
//   - 'elite': capa dourada+holográfica, gated pelo achievement `elite_collector`
//             (validado no server, ver checkEliteEligibility abaixo).
//             Usa `covers/public/elite-cover-ref.png` como referência visual.
//
// Se houver uma figurinha de referência em `style-refs/{TEAM_CODE}.jpg` no Storage,
// ela é enviada como referência visual pra Gemini reproduzir o estilo de figurinha.
//
// Deploy:
//   npx supabase functions deploy generate-cover
// Secrets necessários:
//   npx supabase secrets set GEMINI_API_KEY=AIza...

// @ts-ignore - Deno runtime
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore - Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// @ts-ignore - Deno globals
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
// @ts-ignore - Deno globals
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-ignore - Deno globals
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = 'gemini-3.1-flash-image-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const ELITE_ACHIEVEMENT_CODE = 'elite_collector';
const ELITE_REF_PATH = 'public/elite-cover-ref.png';
// Free user com achievement tem direito a UMA geração de capa Elite.
// Premium fica sem limite.
const ELITE_FREE_QUOTA = 1;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Variant = 'standard' | 'elite';

type StatsInput = {
  player_name: string | null;
  dob: string | null;
  height_m: string | null;
  weight_kg: string | null;
};

type ImageInput = {
  b64: string;
  mime: string;
};

function normalizeImageMimeType(mime: unknown, b64: string): string {
  if (typeof mime === 'string') {
    const normalized = mime.toLowerCase().split(';')[0].trim();
    if (['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(normalized)) {
      return normalized;
    }
  }

  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (b64.startsWith('UklGR')) return 'image/webp';
  if (b64.slice(4, 12).includes('ftyp')) return 'image/heic';
  return 'image/jpeg';
}

function randomBirthDate(): string {
  const year = 1990 + Math.floor(Math.random() * 16); // 1990-2005
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${day}-${month}-${year}`;
}

function buildStatsLine(stats: StatsInput): string {
  const name = stats.player_name?.trim() || 'the person from SUBJECT_SELFIE';
  const dob = stats.dob?.trim() || randomBirthDate();
  const height = stats.height_m?.trim() || `${(1.62 + Math.random() * 0.32).toFixed(2)} m`;
  const weight = stats.weight_kg?.trim() || `${Math.floor(58 + Math.random() * 34)} kg`;
  return `If the sticker has a lower info area, use this fictional player info: name "${name}", date of birth "${dob}", height "${height}", weight "${weight}".`;
}

// Instruções anatômicas e de framing — aplicáveis a TODAS as variantes pra evitar
// rostos enormes / ombros estreitos / pescoço comprido que estavam aparecendo no 1:1.
const ANATOMY_NOTE =
  `IMPORTANT — anatomy and framing: ` +
  `1) Maintain natural human proportions: the head must be proportional to the shoulders ` +
  `(do NOT enlarge or shrink the head), shoulders MUST appear wider than the head, ` +
  `neck has a normal, natural thickness (not stretched, not squished). ` +
  `2) Frame the subject as a chest-up portrait centered vertically in the card, ` +
  `head and shoulders fully visible with a small margin above the hair and at the sides. ` +
  `Do NOT crop the top of the head. Do NOT zoom in only on the face. ` +
  `3) The portrait orientation is VERTICAL 3:4 (taller than wide), like a real collectible ` +
  `Panini sticker. Compose accordingly — never produce a square or wide layout. `;

// Crítico: o output é A FIGURINHA em si, não uma foto da figurinha. Sem mesa, sem
// sombra de objeto físico, sem margem branca, sem "papel sobre superfície".
const FRAMING_NOTE =
  `CRITICAL — the output image IS the collectible sticker itself, filling the ENTIRE ` +
  `frame edge-to-edge. The card's own artwork (background pattern, jersey, frame, banner) ` +
  `fills 100% of the image, all the way to the borders. ` +
  `Do NOT render the sticker as a physical card photographed on a table, desk, scanner, ` +
  `or any surface. Do NOT add any white margin, paper texture, drop shadow under a card, ` +
  `or background environment around the card. There is NO "outside the card" — the image ` +
  `boundary IS the card boundary. `;

// Versão ELITE: composição diferente — card no centro com aura de partículas douradas
// ao redor, fundo preto, como uma "carta premium" flutuando no escuro. SEM chamas/fogo
// (só partículas e pó dourado). Combina com ELITE_STYLE ref.
const ELITE_FRAMING_NOTE =
  `FRAMING (ELITE-specific, overrides generic framing) — The collectible card occupies ` +
  `the CENTER of the image (about 72-78% of the width, centered horizontally and vertically). ` +
  `The remaining area around the card (top, bottom, left, right margins) is a DEEP BLACK ` +
  `background (#000 to #0a0a0a), creating the impression of the card floating in the dark. ` +
  `Around the perimeter of the card, render only golden PARTICLES: floating gold dust motes, ` +
  `tiny shimmering light sparkles and small star-like points of gold light radiating outward. ` +
  `STRICTLY NO FIRE, NO FLAMES, NO FLAME-LIKE WISPS, NO BURNING EMBERS, NO SMOKE, NO HEAT ` +
  `DISTORTION — no fire-like shapes of any kind. Just static, suspended golden particles ` +
  `and pinpoint sparkles of light. The particles are part of the artwork itself (not a photo ` +
  `overlay) and feel magical and premium. The card has a subtle warm internal glow as if lit ` +
  `from within by gold energy. ` +
  `Do NOT render the card as if it were a physical card photographed on a surface — the black ` +
  `background plus surrounding gold particle aura IS the design. ` +
  `BORDER TREATMENT (mandatory, do not skip) — the card has a THICK, CONTINUOUS frame around its entire ` +
  `perimeter rendered with realistic GOLD METALLIC TEXTURE: brushed-gold finish with fine micro-scratches, ` +
  `subtle bevels, specular highlights, deep warm-to-cool color shifts, and crisp light reflections that ` +
  `clearly read as polished metal — NOT a flat gold color, NOT a thin outline, NOT just a glow. ` +
  `The border itself must look like real gold leaf / gold foil with depth and dimensionality. ` +
  `CARD SHAPE (mandatory) — the card has clearly visible ROUNDED CORNERS with a generous corner radius, ` +
  `like a real premium trading card (think Pokémon/Magic foil card). NEVER sharp 90° corners. The ` +
  `rounded-corner shape applies to the outer edge of the gold metallic border AND to the inner photo area. `;

// Crítico (legal/IP): nunca incluir logos do tournament/sticker brand (FIFA, Panini,
// FWC2026) nem do fabricante (Adidas, Nike, Puma) nem patrocinadores.
// O crest da federação (CBF, AFA, etc) PODE aparecer — é o que faz a figurinha
// reconhecível como "do Brasil" sem violar trademarks do tournament.
const LEGAL_NOTE =
  `STRICTLY DO NOT INCLUDE any of the following anywhere in the image — not on the jersey, ` +
  `not on the background, not on the banner, not in the corners, not as a watermark, ` +
  `not even partially or stylized: ` +
  `(a) the word "PANINI" or any Panini logo/wordmark/trade dress; ` +
  `(b) the word "FIFA" or the FIFA logo/wordmark; ` +
  `(c) any official FIFA World Cup logo, the FWC 2026 official emblem, the official ` +
  `World Cup Trophy silhouette, or any official tournament trademark; ` +
  `(d) any jersey manufacturer logo (Adidas, Nike, Puma, Umbro, New Balance, etc) ` +
  `on the chest, sleeves, or shorts; ` +
  `(e) any commercial sponsor or kit-sponsor logo. ` +
  `The jersey colors and the national team crest (e.g. the country's football federation ` +
  `crest like CBF for Brazil, AFA for Argentina, etc) MAY appear on the chest — they help ` +
  `make the player recognizable as their national team. Just don't add the FIFA badge ` +
  `or the World Cup star above/around the federation crest. ` +
  `Replace tournament/sponsor/manufacturer marks with neutral geometric shapes, solid ` +
  `color blocks, or simply omit them. ` +
  `This rule overrides any style reference — if a reference image contains tournament ` +
  `or manufacturer logos, ignore those specific parts. `;

function buildPromptParts(
  teamName: string,
  variant: Variant,
  selfie: ImageInput,
  styleRef: { b64: string; mime: string } | null,
  eliteRef: { b64: string; mime: string } | null,
  stats: StatsInput,
): any[] {
  const statsLine = buildStatsLine(stats);

  // Variante ELITE: combina dois refs.
  //  - TEAM_TEMPLATE (styleRef, opcional): estrutura/cor/layout da figurinha da seleção.
  //  - ELITE_STYLE (eliteRef, idealmente sempre presente): acabamento dourado+holográfico.
  // Quando ambos existem, a IA usa a base da figurinha de seleção e aplica o tratamento
  // gold/holographic por cima. Quando só o ELITE_STYLE existe, descreve o tratamento.
  if (variant === 'elite') {
    const hasTeam = !!styleRef;
    const hasElite = !!eliteRef;

    const elitePrompt =
      `Generate one new VERTICAL 3:4 portrait collectible sticker in the ELITE GOLD HOLOGRAPHIC style, ` +
      `with the card floating on a deep black background surrounded by golden fire / ember particles. ` +
      `The person in the final image MUST be the person from SUBJECT_SELFIE. ` +
      `Preserve their face, hair, skin tone, age, expression and recognizable features. ` +
      ANATOMY_NOTE +
      ELITE_FRAMING_NOTE +
      LEGAL_NOTE +
      (hasTeam
        ? `Use TEAM_TEMPLATE as the base structure: same background layout, geometric shapes, ` +
          `framing, jersey colors and lower info-banner positioning. Recreate the card layout closely, ` +
          `but replace any Panini logo, brand mark or trademark. ` +
          `Do not copy the TEAM_TEMPLATE person's face, hair, pose, name, number or identity. `
        : '') +
      (hasElite
        ? `Apply ELITE_STYLE as the finishing treatment on top of the base: a thick rounded-corner ` +
          `frame with realistic GOLD METALLIC TEXTURE (brushed gold, micro-scratches, bevels, specular ` +
          `highlights — like real gold leaf, not flat color), iridescent rainbow holographic foil overlay ` +
          `across background and jersey, deep prismatic light reflections, subtle starburst sparkles, ` +
          `premium foil texture, crisp gold typography for player name and number. The card outline ` +
          `has GENEROUSLY ROUNDED CORNERS — never sharp 90° corners. Combine the base team look (from ` +
          `TEAM_TEMPLATE) with the gold holographic finish (from ELITE_STYLE) so the card clearly ` +
          `belongs to the ${teamName} sticker family but in its rarest, most premium version. ` +
          `Do not copy the ELITE_STYLE person's face, hair, pose, jersey, name, number or identity. `
        : `Apply a metallic gold + holographic foil aesthetic: a thick rounded-corner frame with ` +
          `realistic GOLD METALLIC TEXTURE (brushed gold, micro-scratches, bevels, specular highlights — ` +
          `like real gold leaf, not flat color), iridescent rainbow holographic overlay, prismatic ` +
          `shimmer, premium foil texture, subtle starburst patterns, gold typography for the player ` +
          `name and number. The card outline has GENEROUSLY ROUNDED CORNERS — never sharp 90° corners. `) +
      `Make them wear the official ${teamName} national soccer team jersey for the FIFA World Cup 2026, ` +
      `chest crest visible, with gold/holographic stylization integrated into the jersey treatment. ` +
      `If style and identity conflict, prioritize SUBJECT_SELFIE identity. ` +
      `Keep the person's original facial expression from SUBJECT_SELFIE — do not force a smile or change their mood. ` +
      `Remove or replace any Panini logo, brand mark, watermark or official trademark. ${statsLine}`;

    const parts: any[] = [
      { text: 'SUBJECT_SELFIE: identity source. The final image must use this person, not any reference player.' },
      { inlineData: { mimeType: selfie.mime, data: selfie.b64 } },
    ];
    if (hasTeam) {
      parts.push({
        text: `TEAM_TEMPLATE: base sticker structure/layout/colors for the ${teamName} national team. ` +
          `Use only its visual structure. Ignore the person identity inside this image.`,
      });
      parts.push({ inlineData: { mimeType: styleRef!.mime, data: styleRef!.b64 } });
    }
    if (hasElite) {
      parts.push({
        text: 'ELITE_STYLE: gold + holographic finishing treatment to apply on top of the base. ' +
          'Use only its surface materials, lighting and foil effects. Ignore the person identity inside this image.',
      });
      parts.push({ inlineData: { mimeType: eliteRef!.mime, data: eliteRef!.b64 } });
    }
    parts.push({ text: elitePrompt });
    return parts;
  }

  // Variante STANDARD (comportamento original)
  if (!styleRef) {
    const prompt =
      `Turn SUBJECT_SELFIE into a VERTICAL 3:4 soccer sticker portrait. Use the same person from the photo, ` +
      `keeping their identity and expression recognizable. Put them in a ${teamName} national team jersey ` +
      `and use a clean collectible sticker style. ` +
      ANATOMY_NOTE +
      FRAMING_NOTE +
      LEGAL_NOTE +
      ' ' +
      statsLine;
    return [
      { text: 'SUBJECT_SELFIE: use this person as the player in the final sticker.' },
      { inlineData: { mimeType: selfie.mime, data: selfie.b64 } },
      { text: prompt },
    ];
  }

  const finalPrompt =
    `Generate one new VERTICAL 3:4 portrait sticker. The person in the final image MUST be the person from ` +
    `SUBJECT_SELFIE. Preserve their face, hair, skin tone, age, expression and recognizable features. ` +
    ANATOMY_NOTE +
    `Use STYLE_REFERENCE as the exact visual template for the sticker design: background pattern, background colors, ` +
    `lighting, crop, framing, border treatment, geometric shapes, gradients, shadows and lower info-banner layout. ` +
    `Recreate the background and card layout as closely as possible, but remove or replace any Panini logo, brand mark, ` +
    `watermark or official trademark. The player/person shown in STYLE_REFERENCE is not the subject. ` +
    `Do not copy, trace, preserve, or recreate the STYLE_REFERENCE person's face, hair, body, pose, jersey, name, ` +
    `number or identity. ` +
    `Make them wear the official ${teamName} national soccer team jersey for the FIFA World Cup 2026, ` +
    `chest crest visible. If style and identity conflict, prioritize SUBJECT_SELFIE identity and simplify the style. ` +
    `Keep the person's original facial expression from SUBJECT_SELFIE — do not force a smile or change their mood. ${statsLine}`;

  return [
    { text: 'SUBJECT_SELFIE: identity source. The final image must use this person, not the reference player.' },
    { inlineData: { mimeType: selfie.mime, data: selfie.b64 } },
    { text: 'STYLE_REFERENCE: design reference only. Ignore the person/player identity inside this image.' },
    { inlineData: { mimeType: styleRef.mime, data: styleRef.b64 } },
    { text: finalPrompt },
  ];
}

async function bytesToB64(bytes: Uint8Array): Promise<string> {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

async function fetchStyleRef(
  supabase: any,
  teamCode: string,
): Promise<{ b64: string; mime: string } | null> {
  // Tenta jpg, depois png
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    try {
      const { data, error } = await supabase.storage
        .from('style-refs')
        .download(`${teamCode}.${ext}`);
      if (error || !data) continue;
      const buffer = await data.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const mime =
        ext === 'png'
          ? 'image/png'
          : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
      return { b64: await bytesToB64(bytes), mime };
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchEliteRef(
  supabase: any,
): Promise<{ b64: string; mime: string } | null> {
  // Referência única usada pra todas as capas Elite — upload manual feito uma vez
  // (ver docs/payments-setup.md, seção Elite Cover Reference).
  try {
    const { data, error } = await supabase.storage
      .from('covers')
      .download(ELITE_REF_PATH);
    if (error || !data) return null;
    const buffer = await data.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return { b64: await bytesToB64(bytes), mime: 'image/png' };
  } catch {
    return null;
  }
}

type EliteEligibility =
  | { ok: true; isPremium: boolean; alreadyGenerated: number }
  | { ok: false; reason: 'elite_locked' | 'elite_quota_exhausted' };

async function checkEliteEligibility(
  supabase: any,
  userId: string,
): Promise<EliteEligibility> {
  // 1) Achievement é pré-requisito pra QUALQUER user (free ou premium).
  const { data: achiev, error: achievErr } = await supabase
    .from('user_achievements')
    .select('code')
    .eq('user_id', userId)
    .eq('code', ELITE_ACHIEVEMENT_CODE)
    .maybeSingle();
  if (achievErr) {
    console.warn('[generate-cover:elite_check_fail]', achievErr.message);
    return { ok: false, reason: 'elite_locked' };
  }
  if (!achiev) return { ok: false, reason: 'elite_locked' };

  // 2) Lê is_premium + contador pra decidir cota. Premium ignora.
  const { data: prof, error: profErr } = await supabase
    .from('profiles')
    .select('is_premium, elite_covers_generated')
    .eq('id', userId)
    .maybeSingle();
  if (profErr || !prof) {
    console.warn('[generate-cover:profile_read_fail]', profErr?.message);
    // Sem info de profile, bloqueia conservadoramente (fail-closed).
    return { ok: false, reason: 'elite_quota_exhausted' };
  }

  const isPremium = !!prof.is_premium;
  const alreadyGenerated = (prof.elite_covers_generated as number) ?? 0;

  if (!isPremium && alreadyGenerated >= ELITE_FREE_QUOTA) {
    return { ok: false, reason: 'elite_quota_exhausted' };
  }
  return { ok: true, isPremium, alreadyGenerated };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: CORS });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return new Response('missing auth', { status: 401, headers: CORS });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response('invalid auth', { status: 401, headers: CORS });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const {
      selfie_base64,
      selfie_mime_type,
      team_code,
      team_name,
      player_name,
      dob,
      height_m,
      weight_kg,
      variant: variantRaw,
    } = body as {
      selfie_base64: string;
      selfie_mime_type?: string | null;
      team_code: string;
      team_name: string;
      player_name?: string | null;
      dob?: string | null;
      height_m?: string | null;
      weight_kg?: string | null;
      variant?: string | null;
    };
    if (!selfie_base64 || !team_code || !team_name) {
      return new Response('missing fields', { status: 400, headers: CORS });
    }

    const variant: Variant = variantRaw === 'elite' ? 'elite' : 'standard';

    // Gate Elite no servidor — não pode confiar no client.
    // Free user com achievement tem 1 geração; Premium é ilimitado.
    let eliteAlreadyGenerated = 0;
    if (variant === 'elite') {
      const eligibility = await checkEliteEligibility(supabase, userId);
      if (!eligibility.ok) {
        const isLocked = eligibility.reason === 'elite_locked';
        return new Response(
          JSON.stringify({
            error: eligibility.reason,
            user_message: isLocked
              ? 'A capa dourada só desbloqueia depois de você completar os 43 craques do álbum.'
              : 'Você já gerou sua capa dourada grátis. Pra gerar outras, ative o Premium.',
          }),
          {
            status: isLocked ? 403 : 402,
            headers: { ...CORS, 'content-type': 'application/json' },
          },
        );
      }
      eliteAlreadyGenerated = eligibility.alreadyGenerated;
    }

    // Refs em paralelo. Standard usa só team. Elite usa team (base) + elite (finish).
    const [teamStyleRef, eliteStyleRef] = await Promise.all([
      fetchStyleRef(supabase, team_code),
      variant === 'elite' ? fetchEliteRef(supabase) : Promise.resolve(null),
    ]);
    const selfieMime = normalizeImageMimeType(selfie_mime_type, selfie_base64);
    const selfie = { b64: selfie_base64, mime: selfieMime };
    const stats = {
      player_name: player_name ?? null,
      dob: dob ?? null,
      height_m: height_m ?? null,
      weight_kg: weight_kg ?? null,
    };

    console.log('[generate-cover:input]', JSON.stringify({
      user_id: userId,
      team_code,
      variant,
      selfie_b64_len: selfie_base64?.length ?? 0,
      selfie_b64_preview: selfie_base64?.slice(0, 24) ?? null,
      selfie_mime: selfieMime,
      has_team_ref: !!teamStyleRef,
      has_elite_ref: !!eliteStyleRef,
    }));

    // First attempt: full prompt (com style-ref se houver).
    let attempt = await callGemini(
      buildPromptParts(team_name, variant, selfie, teamStyleRef, eliteStyleRef, stats),
      'attempt_1',
    );
    let usedStyleRef = !!(teamStyleRef || eliteStyleRef);

    // Retry sem refs se a primeira tentativa não retornou imagem com motivo retriável.
    if (!attempt.imageB64 && (teamStyleRef || eliteStyleRef) && shouldRetry(attempt.finishReason, attempt.httpStatus)) {
      console.log('[generate-cover:retry] retrying without refs', JSON.stringify({
        finish_reason: attempt.finishReason,
      }));
      attempt = await callGemini(
        buildPromptParts(team_name, variant, selfie, null, null, stats),
        'attempt_2_no_refs',
      );
      usedStyleRef = false;
    }

    if (!attempt.imageB64) {
      const userMessage = friendlyMessage(attempt.finishReason, attempt.blockReason);
      console.warn('[generate-cover:gave_up]', JSON.stringify({
        finish_reason: attempt.finishReason,
        block_reason: attempt.blockReason,
        http_status: attempt.httpStatus,
      }));
      return new Response(
        JSON.stringify({
          error: 'gen_failed',
          user_message: userMessage,
          detail: attempt.detail?.slice(0, 400),
        }),
        { status: 502, headers: { ...CORS, 'content-type': 'application/json' } },
      );
    }

    const imageB64 = attempt.imageB64;

    // A capa NÃO vai mais pro Storage. É devolvida em base64 na resposta e o
    // app a salva no FileSystem do device (ver src/lib/covers.ts) — isso zera o
    // egress e o armazenamento de capas no Supabase. A galeria também passou a
    // ser local, então a tabela `user_covers` deixou de ser usada.

    // O profile ainda guarda o time favorito (usado pra bandeira no app) e o
    // contador anti-fraude da cota Elite — ambos precisam ficar no servidor.
    const profileUpdate: Record<string, unknown> = {
      favorite_team_code: team_code,
      updated_at: new Date().toISOString(),
    };
    if (variant === 'elite') {
      profileUpdate.elite_covers_generated = eliteAlreadyGenerated + 1;
    }
    await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId);

    return new Response(
      JSON.stringify({
        image_base64: imageB64,
        variant,
        used_style_ref: usedStyleRef,
      }),
      { status: 200, headers: { ...CORS, 'content-type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: 'internal',
        user_message: 'A IA travou agora. Tenta de novo em alguns segundos.',
        detail: e?.message ?? String(e),
      }),
      { status: 500, headers: { ...CORS, 'content-type': 'application/json' } },
    );
  }
});

type GeminiAttempt = {
  imageB64?: string;
  finishReason?: string;
  blockReason?: string;
  httpStatus: number;
  detail?: string;
};

async function callGemini(parts: any[], label: string): Promise<GeminiAttempt> {
  const geminiBody = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        // Figurinha Panini é vertical (retrato). 3:4 = ~ratio do card colecionável real.
        // Antes era 1:1 (quadrado), gerava proporções estranhas de cabeça/ombros.
        aspectRatio: '3:4',
        imageSize: '1K',
      },
      temperature: 0.35,
    },
  };

  const res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(geminiBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn(`[generate-cover:${label}] http ${res.status}`, errText.slice(0, 400));
    return { httpStatus: res.status, detail: errText };
  }

  const json = await res.json();
  const part = json?.candidates?.[0]?.content?.parts?.find(
    (p: any) => p?.inlineData?.data || p?.inline_data?.data,
  );
  const imageB64: string | undefined = part?.inlineData?.data ?? part?.inline_data?.data;
  const finishReason: string | undefined = json?.candidates?.[0]?.finishReason;
  const blockReason: string | undefined = json?.promptFeedback?.blockReason;

  console.log(`[generate-cover:${label}]`, JSON.stringify({
    finish_reason: finishReason,
    block_reason: blockReason,
    safety: json?.candidates?.[0]?.safetyRatings,
    part_count: json?.candidates?.[0]?.content?.parts?.length ?? 0,
    has_image: !!imageB64,
    image_b64_len: imageB64?.length ?? 0,
  }));

  return {
    imageB64,
    finishReason,
    blockReason,
    httpStatus: res.status,
    detail: imageB64 ? undefined : JSON.stringify(json),
  };
}

function shouldRetry(finishReason?: string, httpStatus?: number): boolean {
  if (httpStatus && httpStatus >= 500) return true;
  if (!finishReason) return true;
  const retriable = new Set(['MALFORMED_FUNCTION_CALL', 'OTHER', 'RECITATION', 'IMAGE_OTHER']);
  return retriable.has(finishReason);
}

function friendlyMessage(finishReason?: string, blockReason?: string): string {
  if (blockReason || finishReason === 'SAFETY') {
    return 'A IA não conseguiu processar essa foto (filtros de segurança). Tenta com outra selfie em que seu rosto esteja bem visível.';
  }
  if (finishReason === 'MALFORMED_FUNCTION_CALL' || finishReason === 'OTHER') {
    return 'A IA travou nessa combinação. Tenta de novo — se persistir, tira outra foto ou escolhe outra seleção.';
  }
  if (finishReason === 'IMAGE_PROHIBITED_CONTENT' || finishReason === 'PROHIBITED_CONTENT') {
    return 'A foto tem algo que a IA não consegue gerar. Tenta uma selfie mais simples, sem texto/logos no fundo.';
  }
  return 'A IA não conseguiu gerar agora. Tenta de novo em alguns segundos.';
}
