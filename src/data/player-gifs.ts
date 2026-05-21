// Slots do álbum que têm GIF de celebração no bucket `player-gifs` do Supabase Storage.
// Mantém em sync com scripts/upload-player-gifs.ts — se subir um GIF novo, adicionar aqui.

import Constants from 'expo-constants';

const PLAYER_GIF_SLOTS = new Set<string>([
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
]);

function supabaseUrl(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string };
  return process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? null;
}

export function hasPlayerGif(teamCode: string | null | undefined, number: string): boolean {
  if (!teamCode) return false;
  return PLAYER_GIF_SLOTS.has(`${teamCode}-${number}`);
}

export function getPlayerGifUrl(
  teamCode: string | null | undefined,
  number: string,
): string | null {
  if (!hasPlayerGif(teamCode, number)) return null;
  const url = supabaseUrl();
  if (!url) return null;
  return `${url}/storage/v1/object/public/player-gifs/${teamCode}-${number}.gif`;
}
