// Normaliza string pra busca: remove acentos/diacríticos e baixa pra lowercase.
// "Vinícius Jr" -> "vinicius jr", "São Paulo" -> "sao paulo", "Núñez" -> "nunez".
const DIACRITICS = /[̀-ͯ]/g;

export function normalizeSearch(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}
