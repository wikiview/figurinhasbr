// Dá os 43 craques (stickers com GIF) pra todos os profiles já cadastrados.
// Idempotente — quem já tem (qty >= 1), fica como está; quem não tem, ganha qty=1.
//
// Uso:    npx tsx scripts/grant-craques.ts
//
// .env requer:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  (bypassa RLS)

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Faltam EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Espelha PLAYER_GIF_SLOTS em src/data/player-gifs.ts (43 slots).
const CRAQUE_IDS = [
  'ARG-9', 'ARG-17', 'ARG-18', 'ARG-19',
  'BEL-15',
  'BRA-2', 'BRA-14', 'BRA-20',
  'CAN-3',
  'COL-20',
  'CRO-4', 'CRO-9',
  'EGY-17',
  'ENG-11', 'ENG-12', 'ENG-16', 'ENG-17', 'ENG-18',
  'ESP-10', 'ESP-15', 'ESP-17',
  'FRA-2', 'FRA-3', 'FRA-4', 'FRA-20',
  'GER-11', 'GER-15',
  'KOR-18',
  'MAR-4',
  'MEX-16',
  'NED-3', 'NED-15',
  'NOR-15',
  'POR-9', 'POR-10', 'POR-12', 'POR-15', 'POR-20',
  'TUR-14', 'TUR-20',
  'URU-10', 'URU-17',
  'USA-16',
];

async function main() {
  console.log(`Craques no script: ${CRAQUE_IDS.length}`);

  // 1. Confere que todos os IDs existem no catálogo
  const { data: stickers, error: e0 } = await supabase
    .from('stickers')
    .select('id')
    .in('id', CRAQUE_IDS);
  if (e0) {
    console.error('Erro ao listar stickers:', e0);
    process.exit(1);
  }
  const presentIds = new Set((stickers ?? []).map((s: { id: string }) => s.id));
  const missing = CRAQUE_IDS.filter((id) => !presentIds.has(id));
  if (missing.length > 0) {
    console.error('IDs que NÃO existem em public.stickers:', missing);
    console.error('Aborta — rode `npm run seed:stickers` primeiro.');
    process.exit(1);
  }
  console.log(`  ✓ todos os ${CRAQUE_IDS.length} existem em public.stickers`);

  // 2. Lista todos os profiles
  const { data: users, error: e1 } = await supabase
    .from('profiles')
    .select('id, display_name');
  if (e1) {
    console.error('Erro ao listar profiles:', e1);
    process.exit(1);
  }
  const profiles = users ?? [];
  console.log(`Profiles encontrados: ${profiles.length}\n`);

  // 3. Pra cada user, upsert com qty = max(qty_atual, 1)
  let totalNovos = 0;
  let totalMantidos = 0;

  for (const u of profiles) {
    const { data: existing, error: e2 } = await supabase
      .from('user_stickers')
      .select('sticker_id, qty')
      .eq('user_id', u.id)
      .in('sticker_id', CRAQUE_IDS);
    if (e2) {
      console.error(`  [${u.display_name}] erro listando user_stickers:`, e2);
      continue;
    }
    const have = new Map(
      (existing ?? []).map((r: { sticker_id: string; qty: number }) => [r.sticker_id, r.qty]),
    );

    const rows = CRAQUE_IDS.map((sid) => ({
      user_id: u.id,
      sticker_id: sid,
      qty: Math.max(have.get(sid) ?? 0, 1),
      updated_at: new Date().toISOString(),
    }));

    const novos = CRAQUE_IDS.filter((sid) => (have.get(sid) ?? 0) < 1).length;
    const mantidos = CRAQUE_IDS.length - novos;

    const { error: e3 } = await supabase
      .from('user_stickers')
      .upsert(rows, { onConflict: 'user_id,sticker_id' });
    if (e3) {
      console.error(`  [${u.display_name}] erro upsert:`, e3);
      continue;
    }

    totalNovos += novos;
    totalMantidos += mantidos;
    console.log(`  [${u.display_name ?? u.id}] +${novos} novos, ${mantidos} já tinha`);
  }

  console.log(`\nTotal: +${totalNovos} novas posses, ${totalMantidos} já existiam.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
