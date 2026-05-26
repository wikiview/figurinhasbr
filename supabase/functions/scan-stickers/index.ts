// Supabase Edge Function: scan-stickers
// Recebe { photo_base64 } com foto de múltiplas figurinhas (versos visíveis),
// chama Gemini 2.5 Flash em modo structured-JSON pra extrair todos os códigos.
//
// Deploy:
//   npx supabase functions deploy scan-stickers
// Secrets necessários: GEMINI_API_KEY já setada (compartilha com generate-cover).

// @ts-ignore
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// @ts-ignore
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_TEAM_CODES = [
  'MEX', 'RSA', 'KOR', 'CZE', 'CAN', 'BIH', 'QAT', 'SUI', 'BRA', 'MAR',
  'HAI', 'SCO', 'USA', 'PAR', 'AUS', 'TUR', 'GER', 'CUW', 'CIV', 'ECU',
  'NED', 'JPN', 'SWE', 'TUN', 'BEL', 'EGY', 'IRN', 'NZL', 'ESP', 'CPV',
  'KSA', 'URU', 'FRA', 'SEN', 'IRQ', 'NOR', 'ARG', 'ALG', 'AUT', 'JOR',
  'POR', 'COD', 'UZB', 'COL', 'ENG', 'CRO', 'GHA', 'PAN',
];

function buildPrompt(): string {
  return [
    `Você está vendo o VERSO de figurinhas do álbum de coleção do usuário.`,
    `Cada verso tem um código impresso no topo no formato exato: "<CÓDIGO> <NÚMERO>".`,
    `Exemplos: "BRA 5", "FWC 14", "KOR 18", "ARG 17".`,
    `Códigos válidos de seleção (3 letras): ${VALID_TEAM_CODES.join(', ')}.`,
    `Especiais usam prefixo "FWC" (FWC 0 a FWC 19).`,
    `Existem ainda 4 figurinhas extras esmaltadas com códigos: REGU, BRON, PRAT, OURO (sem número).`,
    `E 14 extras com prefixo CC: CC 1 a CC 14.`,
    `Identifique TODA figurinha física visível na foto, contando duplicatas.`,
    `Para cada uma, retorne o código no formato: "<CÓDIGO>-<NÚMERO>" (com hífen).`,
    `Exemplos de saída: "BRA-5", "FWC-14", "EXTRA-REGU", "CC-3", "FWC-00" (pra Somos 26).`,
    `Só inclua códigos que você consegue ler com NITIDEZ. Se tem dúvida, NÃO inclua — melhor faltar do que inventar.`,
    `IMPORTANTE: se o usuário fotografou 3 cópias físicas da BRA-5, retorne "BRA-5" três vezes no array.`,
    `Se viu 14 figurinhas físicas na foto, o array deve ter 14 entradas (mesmo que alguns códigos se repitam).`,
  ].join(' ');
}

const responseSchema = {
  type: 'object',
  properties: {
    codes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['codes'],
};

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

    const body = await req.json();
    const { photo_base64 } = body as { photo_base64: string };
    if (!photo_base64) {
      return new Response('missing photo', { status: 400, headers: CORS });
    }

    const geminiBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildPrompt() },
            { inlineData: { mimeType: 'image/jpeg', data: photo_base64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.1,
      },
    };

    const r = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!r.ok) {
      const txt = await r.text();
      return new Response(
        JSON.stringify({ error: 'gemini_failed', detail: txt.slice(0, 800) }),
        { status: 502, headers: { ...CORS, 'content-type': 'application/json' } },
      );
    }

    const json = await r.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    let codes: string[] = [];
    try {
      const parsed = JSON.parse(text);
      codes = Array.isArray(parsed.codes)
        ? parsed.codes.filter((c: any) => typeof c === 'string').map((c: string) => c.trim().toUpperCase())
        : [];
    } catch {
      // fallback regex se JSON vier malformado
      const matches = text.match(/[A-Z]{3,5}-[A-Z0-9]+/g) ?? [];
      codes = matches.map((c: string) => c.toUpperCase());
    }

    // Valida códigos contra os IDs reais (apenas formato). Mantém duplicatas:
    // o frontend conta as ocorrências pra distinguir "repetida na foto" de
    // "repetida na coleção".
    const valid = codes.filter((c: string) => /^[A-Z]{3,5}-[A-Z0-9]+$/.test(c));

    return new Response(
      JSON.stringify({ codes: valid, raw_count: codes.length }),
      { status: 200, headers: { ...CORS, 'content-type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: 'internal', detail: e?.message ?? String(e) }),
      { status: 500, headers: { ...CORS, 'content-type': 'application/json' } },
    );
  }
});
