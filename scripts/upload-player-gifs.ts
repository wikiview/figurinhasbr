// Sobe os GIFs de celebração dos top players pro bucket `player-gifs` no Supabase Storage.
// Idempotente: cria o bucket se não existir, faz upsert de cada arquivo.
//
// Uso:    npx tsx scripts/upload-player-gifs.ts
//
// .env requer:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  (NUNCA commitar — bypassa RLS)

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Faltam EXPO_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const SOURCE_DIR =
  process.env.PLAYER_GIFS_DIR ??
  'C:\\Users\\Pichau\\Downloads\\App Album-20260502T174239Z-3-001\\App Album';

const BUCKET = 'player-gifs';

// filename na pasta de origem → slot no álbum (TEAM-NUMBER)
// Apenas jogadores que existem em src/data/players.ts. 5 GIFs ficam de fora
// (Garnacho, Osimhen, Endrick, Griezmann, Kobbie Mainoo) — sem slot no álbum.
const FILENAME_TO_SLOT: Record<string, { team: string; number: string }> = {
  'Achraf Hakimi Marrocos.gif': { team: 'MAR', number: '4' },
  'Alisson Brasil.gif': { team: 'BRA', number: '2' },
  'Christian Pulisic.gif': { team: 'USA', number: '16' },
  'Cole Palmer Inglaterra.gif': { team: 'ENG', number: '12' },
  'Heung-min Son Coreia do Sul.gif': { team: 'KOR', number: '18' },
  'Josko Gvardiol Croácia.gif': { team: 'CRO', number: '4' },
  'Kenan Yıldız Turquia.gif': { team: 'TUR', number: '20' },
  'Kylian Mbappé.gif': { team: 'FRA', number: '20' },
  'Lionel Messi.gif': { team: 'ARG', number: '17' },
  'Luka Modric Croácia.gif': { team: 'CRO', number: '9' },
  'Vitinha Portugal.gif': { team: 'POR', number: '12' },
  'alphonso davies.gif': { team: 'CAN', number: '3' },
  'arda guler.gif': { team: 'TUR', number: '14' },
  'bernardo silva.gif': { team: 'POR', number: '9' },
  'bruno fernandes.gif': { team: 'POR', number: '10' },
  'cristiano ronaldo.gif': { team: 'POR', number: '15' },
  'darwin nuñez.gif': { team: 'URU', number: '17' },
  'erling haaland.gif': { team: 'NOR', number: '15' },
  'estevao willian.gif': { team: 'BRA', number: '20' },
  'federico valverde.gif': { team: 'URU', number: '10' },
  'florian wirtz.gif': { team: 'GER', number: '11' },
  'harry kane.gif': { team: 'ENG', number: '18' },
  'jamal musiala.gif': { team: 'GER', number: '15' },
  'jude bellingham.gif': { team: 'ENG', number: '11' },
  'julian alvarez.gif': { team: 'ARG', number: '19' },
  'kevin de bruyne.gif': { team: 'BEL', number: '15' },
  'lamine yamal.gif': { team: 'ESP', number: '15' },
  'lautaro martinez.gif': { team: 'ARG', number: '18' },
  'luis diaz.gif': { team: 'COL', number: '20' },
  'mac allister.gif': { team: 'ARG', number: '9' },
  'mike maignan.gif': { team: 'FRA', number: '2' },
  'mohamed salah.gif': { team: 'EGY', number: '17' },
  'nico williams.gif': { team: 'ESP', number: '17' },
  'phil phoden.gif': { team: 'ENG', number: '16' },
  'rafael leao.gif': { team: 'POR', number: '20' },
  'rodri.gif': { team: 'ESP', number: '10' },
  'saka.gif': { team: 'ENG', number: '17' },
  'santiago gimenez.gif': { team: 'MEX', number: '16' },
  'theo hernandez.gif': { team: 'FRA', number: '3' },
  'van dijk.gif': { team: 'NED', number: '3' },
  'vinicius junior.gif': { team: 'BRA', number: '14' },
  'william saliba.gif': { team: 'FRA', number: '4' },
  'xavi simons.gif': { team: 'NED', number: '15' },
};

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Erro ao listar buckets:', error);
    process.exit(1);
  }
  const exists = (buckets ?? []).some((b) => b.name === BUCKET);
  if (exists) {
    console.log(`✓ Bucket '${BUCKET}' já existe.`);
    return;
  }
  console.log(`Criando bucket '${BUCKET}' (público)…`);
  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 20 * 1024 * 1024, // 20 MB por arquivo
    allowedMimeTypes: ['image/gif'],
  });
  if (createErr) {
    console.error('Erro ao criar bucket:', createErr);
    process.exit(1);
  }
  console.log(`✓ Bucket '${BUCKET}' criado.`);
}

async function main() {
  await ensureBucket();

  const entries = Object.entries(FILENAME_TO_SLOT);
  console.log(`\nSubindo ${entries.length} GIFs de ${SOURCE_DIR}\n`);

  let ok = 0;
  let fail = 0;
  for (const [filename, slot] of entries) {
    const localPath = join(SOURCE_DIR, filename);
    if (!existsSync(localPath)) {
      console.warn(`  ⚠ não achei ${filename}, pulando`);
      fail++;
      continue;
    }
    const buf = readFileSync(localPath);
    const remotePath = `${slot.team}-${slot.number}.gif`;
    const { error } = await supabase.storage.from(BUCKET).upload(remotePath, buf, {
      contentType: 'image/gif',
      upsert: true,
    });
    if (error) {
      console.error(`  ✗ ${remotePath}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${remotePath} (${(buf.length / 1024).toFixed(0)} KB)`);
      ok++;
    }
  }

  console.log(`\n🎉 ${ok} ok, ${fail} falhas.`);
  if (fail > 0) process.exit(1);
}

main();
