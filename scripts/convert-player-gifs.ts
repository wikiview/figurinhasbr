// Baixa os 43 GIFs de celebração do bucket `player-gifs` e converte cada um pra
// WebP animado redimensionado, salvando em assets/player-gifs/. Depois disso os
// GIFs ficam embutidos no app (ver src/data/player-gifs.ts) — nada de Storage,
// sem download em runtime, sem "loading" antes da celebração.
//
// Uso:    npx tsx scripts/convert-player-gifs.ts
// Requer: ffmpeg no PATH.
// Idempotente: pode rodar de novo pra reconverter (sobrescreve os .webp).

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mantém em sync com PLAYER_GIF_SLOTS em src/data/player-gifs.ts.
const SLOTS = [
  'ARG-9', 'ARG-17', 'ARG-18', 'ARG-19', 'BEL-15', 'BRA-2', 'BRA-14', 'BRA-20',
  'CAN-3', 'COL-20', 'CRO-4', 'CRO-9', 'EGY-17', 'ENG-11', 'ENG-12', 'ENG-16',
  'ENG-17', 'ENG-18', 'ESP-10', 'ESP-15', 'ESP-17', 'FRA-2', 'FRA-3', 'FRA-4',
  'FRA-20', 'GER-11', 'GER-15', 'KOR-18', 'MAR-4', 'MEX-16', 'NED-3', 'NED-15',
  'NOR-15', 'POR-9', 'POR-10', 'POR-12', 'POR-15', 'POR-20', 'TUR-14', 'TUR-20',
  'URU-10', 'URU-17', 'USA-16',
];

const BUCKET_BASE =
  'https://amhmgnlzluhsyikaryyt.supabase.co/storage/v1/object/public/player-gifs';
const OUT_DIR = join(process.cwd(), 'assets', 'player-gifs');
const TMP_DIR = join(tmpdir(), 'figurinha-gif-convert');
const MAX_WIDTH = 460;
const QUALITY = 60;

// Conta os frames de um WebP animado pelos chunks ANMF do container RIFF.
// ffprobe não serve aqui — o demuxer de WebP do ffmpeg não lê WebP animado.
function webpFrames(file: string): number {
  const buf = readFileSync(file);
  let n = 0;
  let idx = 0;
  while ((idx = buf.indexOf('ANMF', idx, 'latin1')) !== -1) {
    n++;
    idx += 4;
  }
  return n;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });

  let totalIn = 0;
  let totalOut = 0;
  let ok = 0;
  const problems: string[] = [];

  for (const slot of SLOTS) {
    const gifPath = join(TMP_DIR, `${slot}.gif`);
    const webpPath = join(OUT_DIR, `${slot}.webp`);

    const res = await fetch(`${BUCKET_BASE}/${slot}.gif`);
    if (!res.ok) {
      problems.push(`${slot}: download HTTP ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(gifPath, buf);

    try {
      execFileSync('ffmpeg', [
        '-y', '-i', gifPath,
        '-vcodec', 'libwebp',
        '-vf', `scale='min(${MAX_WIDTH},iw)':-2:flags=lanczos`,
        '-lossless', '0', '-q:v', String(QUALITY),
        '-compression_level', '6', '-loop', '0', '-preset', 'picture',
        '-an', '-vsync', '0', webpPath,
      ], { stdio: 'pipe' });
    } catch {
      problems.push(`${slot}: ffmpeg falhou`);
      continue;
    }

    const frames = webpFrames(webpPath);
    const inKB = buf.length / 1024;
    const outKB = statSync(webpPath).size / 1024;
    totalIn += inKB;
    totalOut += outKB;
    ok++;

    const animated = frames > 1;
    if (!animated) {
      problems.push(`${slot}: webp saiu com ${frames} frame — nao animado`);
    }
    console.log(
      `${slot.padEnd(9)} ${inKB.toFixed(0).padStart(6)} KB -> ${outKB.toFixed(0).padStart(6)} KB` +
      `  ${String(frames).padStart(4)} frames  ${animated ? 'ok' : '!! ESTATICO !!'}`,
    );
  }

  rmSync(TMP_DIR, { recursive: true, force: true });

  console.log('');
  console.log(`Convertidos: ${ok}/${SLOTS.length}`);
  console.log(
    `Total: ${(totalIn / 1024).toFixed(1)} MB GIF -> ${(totalOut / 1024).toFixed(1)} MB WebP`,
  );
  if (problems.length) {
    console.log('\nPROBLEMAS:');
    for (const p of problems) console.log('  - ' + p);
    process.exit(1);
  }
}

main();
