// Popula a tabela `stickers` com o catálogo do álbum.
// Idempotente: roda quantas vezes quiser.
//
// Uso:    npm run seed:stickers
//
// .env requer:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  (NUNCA commitar — bypassa RLS)

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { SEED_STICKERS } from '../src/data/stickers-seed';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Faltam EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`Catálogo novo: ${SEED_STICKERS.length} figurinhas.`);

  // 1. Lista IDs existentes no banco e remove os que sumiram do catálogo
  const { data: existing, error: e1 } = await supabase
    .from('stickers')
    .select('id');
  if (e1) {
    console.error('Erro ao listar:', e1);
    process.exit(1);
  }
  const newIds = new Set(SEED_STICKERS.map((s) => s.id));
  const stale = (existing ?? [])
    .map((r: { id: string }) => r.id)
    .filter((id) => !newIds.has(id));

  if (stale.length > 0) {
    console.log(`  Removendo ${stale.length} figurinhas antigas (cascade vai limpar user_stickers órfãos)...`);
    // delete em lotes de 500 pra evitar URL gigante
    for (let i = 0; i < stale.length; i += 500) {
      const slice = stale.slice(i, i + 500);
      const { error } = await supabase.from('stickers').delete().in('id', slice);
      if (error) {
        console.error(`Erro deletando lote ${i}:`, error);
        process.exit(1);
      }
    }
  }

  // 2. Upsert do catálogo novo
  const BATCH = 500;
  for (let i = 0; i < SEED_STICKERS.length; i += BATCH) {
    const slice = SEED_STICKERS.slice(i, i + BATCH);
    const { error } = await supabase.from('stickers').upsert(slice, { onConflict: 'id' });
    if (error) {
      console.error(`Erro upsert lote ${i}:`, error);
      process.exit(1);
    }
    console.log(`  ✓ ${i + slice.length}/${SEED_STICKERS.length}`);
  }

  console.log('🎉 Catálogo sincronizado.');
}

main();
