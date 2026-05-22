// Slots do álbum que têm GIF de celebração. Os arquivos são WebP animados
// embutidos no bundle (assets/player-gifs/), convertidos dos GIFs originais via
// scripts/convert-player-gifs.ts. Ficam no app — sem Storage, sem download em
// runtime, sem "loading" antes da celebração tocar.

// O require() precisa ser estático (string literal) pro Metro empacotar o asset.
const PLAYER_GIFS: Record<string, number> = {
  'ARG-9': require('@/assets/player-gifs/ARG-9.webp'),
  'ARG-17': require('@/assets/player-gifs/ARG-17.webp'),
  'ARG-18': require('@/assets/player-gifs/ARG-18.webp'),
  'ARG-19': require('@/assets/player-gifs/ARG-19.webp'),
  'BEL-15': require('@/assets/player-gifs/BEL-15.webp'),
  'BRA-2': require('@/assets/player-gifs/BRA-2.webp'),
  'BRA-14': require('@/assets/player-gifs/BRA-14.webp'),
  'BRA-20': require('@/assets/player-gifs/BRA-20.webp'),
  'CAN-3': require('@/assets/player-gifs/CAN-3.webp'),
  'COL-20': require('@/assets/player-gifs/COL-20.webp'),
  'CRO-4': require('@/assets/player-gifs/CRO-4.webp'),
  'CRO-9': require('@/assets/player-gifs/CRO-9.webp'),
  'EGY-17': require('@/assets/player-gifs/EGY-17.webp'),
  'ENG-11': require('@/assets/player-gifs/ENG-11.webp'),
  'ENG-12': require('@/assets/player-gifs/ENG-12.webp'),
  'ENG-16': require('@/assets/player-gifs/ENG-16.webp'),
  'ENG-17': require('@/assets/player-gifs/ENG-17.webp'),
  'ENG-18': require('@/assets/player-gifs/ENG-18.webp'),
  'ESP-10': require('@/assets/player-gifs/ESP-10.webp'),
  'ESP-15': require('@/assets/player-gifs/ESP-15.webp'),
  'ESP-17': require('@/assets/player-gifs/ESP-17.webp'),
  'FRA-2': require('@/assets/player-gifs/FRA-2.webp'),
  'FRA-3': require('@/assets/player-gifs/FRA-3.webp'),
  'FRA-4': require('@/assets/player-gifs/FRA-4.webp'),
  'FRA-20': require('@/assets/player-gifs/FRA-20.webp'),
  'GER-11': require('@/assets/player-gifs/GER-11.webp'),
  'GER-15': require('@/assets/player-gifs/GER-15.webp'),
  'KOR-18': require('@/assets/player-gifs/KOR-18.webp'),
  'MAR-4': require('@/assets/player-gifs/MAR-4.webp'),
  'MEX-16': require('@/assets/player-gifs/MEX-16.webp'),
  'NED-3': require('@/assets/player-gifs/NED-3.webp'),
  'NED-15': require('@/assets/player-gifs/NED-15.webp'),
  'NOR-15': require('@/assets/player-gifs/NOR-15.webp'),
  'POR-9': require('@/assets/player-gifs/POR-9.webp'),
  'POR-10': require('@/assets/player-gifs/POR-10.webp'),
  'POR-12': require('@/assets/player-gifs/POR-12.webp'),
  'POR-15': require('@/assets/player-gifs/POR-15.webp'),
  'POR-20': require('@/assets/player-gifs/POR-20.webp'),
  'TUR-14': require('@/assets/player-gifs/TUR-14.webp'),
  'TUR-20': require('@/assets/player-gifs/TUR-20.webp'),
  'URU-10': require('@/assets/player-gifs/URU-10.webp'),
  'URU-17': require('@/assets/player-gifs/URU-17.webp'),
  'USA-16': require('@/assets/player-gifs/USA-16.webp'),
};

export function hasPlayerGif(
  teamCode: string | null | undefined,
  number: string,
): boolean {
  if (!teamCode) return false;
  return `${teamCode}-${number}` in PLAYER_GIFS;
}

// Retorna o asset WebP embutido (resultado do require) pra usar direto em
// <Image source={...} /> do expo-image. null se o slot não tem GIF.
export function getPlayerGif(
  teamCode: string | null | undefined,
  number: string,
): number | null {
  if (!teamCode) return null;
  return PLAYER_GIFS[`${teamCode}-${number}`] ?? null;
}
