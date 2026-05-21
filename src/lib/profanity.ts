const BLOCKED_WORDS = [
  'puta', 'puto', 'putinha', 'putinho', 'putona', 'putao',
  'caralho', 'caralhos', 'krl', 'klr',
  'porra', 'porras',
  'foda', 'fodas', 'foder', 'fodase', 'fodaseu', 'fdp', 'fudido', 'fudida',
  'merda', 'merdas', 'bosta', 'bostas',
  'buceta', 'bucetao', 'bct', 'xota', 'xoxota', 'xereca', 'perereca',
  'piroca', 'pirocas', 'rola', 'rolas', 'caceta', 'cacete',
  'bunda', 'bundinha', 'bundao',
  'cu', 'cuzao', 'cusao', 'cuzudo', 'cuzinho',
  'punheta', 'punhetinha', 'gozada', 'gozadinha',
  'porno', 'pornografia',
  'putaria', 'suruba', 'siririca',
  'viado', 'viadinho', 'viadao', 'bicha', 'bichinha', 'bichona',
  'traveco', 'travecao',
  'corno', 'corna', 'cornudo', 'cornuda',
  'vagabundo', 'vagabunda', 'vagaba',
  'prostituta', 'prostituto', 'biscate', 'piranha',
  'otario', 'otaria',
  'retardado', 'retardada', 'mongoloide',
  'arrombado', 'arrombada', 'desgracado', 'desgracada',
  'escroto', 'escrota',
  'cabaco',
  'pedofilo', 'pedofila', 'pedofilia', 'pedo', 'pedobear',
  'estuprador', 'estupradora', 'estupro',
  'crioulo', 'crioula', 'negao', 'negona', 'neguinho', 'neguinha', 'macaco', 'macaca',
  'hitler', 'nazi', 'nazista', 'nazismo', 'kkk', 'klan',
  'admin', 'administrador', 'moderador', 'suporte', 'staff', 'oficial',
];

const SUBSTRING_BLOCKS = [
  'fdp',
  'vsf',
  'tnc',
  'puta',
  'caralho',
  'buceta',
  'foder',
  'cuzao',
  'cuzinho',
  'piroca',
  'viado',
  'corno',
  'porno',
  'pedofil',
  'estupr',
  'nazi',
  'hitler',
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

const NORMALIZED_BLOCKED = new Set(BLOCKED_WORDS.map(normalize));
const NORMALIZED_SUBSTRINGS = SUBSTRING_BLOCKS.map(normalize);

export function containsProfanity(text: string): boolean {
  const norm = normalize(text);
  if (!norm) return false;

  const tokens = norm.split(/[^a-z0-9]+/g).filter(Boolean);
  for (const tok of tokens) {
    if (NORMALIZED_BLOCKED.has(tok)) return true;
  }

  const collapsed = norm.replace(/[^a-z0-9]+/g, '');
  for (const sub of NORMALIZED_SUBSTRINGS) {
    if (collapsed.includes(sub)) return true;
  }

  return false;
}

export function validateDisplayName(text: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = text.trim();
  if (trimmed.length < 2) return { ok: false, reason: 'Nome muito curto (mín. 2 letras).' };
  if (trimmed.length > 30) return { ok: false, reason: 'Nome muito longo (máx. 30 letras).' };
  if (containsProfanity(trimmed)) {
    return { ok: false, reason: 'Esse nome contém palavras não permitidas. Escolha outro.' };
  }
  return { ok: true };
}
