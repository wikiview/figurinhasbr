import type { Sticker } from './types';

export type ExportMode = 'missing' | 'duplicates' | 'have';

// Páginas oficiais por seleção (ordem real do álbum, com gap em 56-57)
const TEAM_PAGES: Record<string, string> = {
  MEX: '8-9',   RSA: '10-11', KOR: '12-13', CZE: '14-15',
  CAN: '16-17', BIH: '18-19', QAT: '20-21', SUI: '22-23',
  BRA: '24-25', MAR: '26-27', HAI: '28-29', SCO: '30-31',
  USA: '32-33', PAR: '34-35', AUS: '36-37', TUR: '38-39',
  GER: '40-41', CUW: '42-43', CIV: '44-45', ECU: '46-47',
  NED: '48-49', JPN: '50-51', SWE: '52-53', TUN: '54-55',
  BEL: '58-59', EGY: '60-61', IRN: '62-63', NZL: '64-65',
  ESP: '66-67', CPV: '68-69', KSA: '70-71', URU: '72-73',
  FRA: '74-75', SEN: '76-77', IRQ: '78-79', NOR: '80-81',
  ARG: '82-83', ALG: '84-85', AUT: '86-87', JOR: '88-89',
  POR: '90-91', COD: '92-93', UZB: '94-95', COL: '96-97',
  ENG: '98-99', CRO: '100-101', GHA: '102-103', PAN: '104-105',
};

// Bandeiras emoji por seleção (em branco quando não tem unicode confiável)
const TEAM_EMOJI: Record<string, string> = {
  MEX: '🇲🇽', RSA: '🇿🇦', KOR: '🇰🇷', CZE: '🇨🇿',
  CAN: '🇨🇦', BIH: '🇧🇦', QAT: '🇶🇦', SUI: '🇨🇭',
  BRA: '🇧🇷', MAR: '🇲🇦', HAI: '🇭🇹', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  USA: '🇺🇸', PAR: '🇵🇾', AUS: '🇦🇺', TUR: '🇹🇷',
  GER: '🇩🇪', CUW: '🇨🇼', CIV: '🇨🇮', ECU: '🇪🇨',
  NED: '🇳🇱', JPN: '🇯🇵', SWE: '🇸🇪', TUN: '🇹🇳',
  BEL: '🇧🇪', EGY: '🇪🇬', IRN: '🇮🇷', NZL: '🇳🇿',
  ESP: '🇪🇸', CPV: '🇨🇻', KSA: '🇸🇦', URU: '🇺🇾',
  FRA: '🇫🇷', SEN: '🇸🇳', IRQ: '🇮🇶', NOR: '🇳🇴',
  ARG: '🇦🇷', ALG: '🇩🇿', AUT: '🇦🇹', JOR: '🇯🇴',
  POR: '🇵🇹', COD: '🇨🇩', UZB: '🇺🇿', COL: '🇨🇴',
  ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', CRO: '🇭🇷', GHA: '🇬🇭', PAN: '🇵🇦',
};

const TEAM_ORDER = Object.keys(TEAM_PAGES);

// Como a figurinha aparece no texto exportado (sem hífen interno)
function displayCode(s: Sticker): string {
  if (s.id === 'FWC-00') return '00';
  if (s.team_code === 'EXTRA') return s.number; // REGU, BRON, PRAT, OURO
  return `${s.team_code}${s.number}`;
}

function chunkLines(items: string[], perLine = 5): string[] {
  const out: string[] = [];
  for (let i = 0; i < items.length; i += perLine) {
    out.push(items.slice(i, i + perLine).join(', '));
  }
  return out;
}

export function buildExportText(
  stickers: Sticker[],
  qtyMap: Record<string, number>,
  mode: ExportMode,
  authorName?: string,
): string {
  const inMode = (s: Sticker) => {
    const q = qtyMap[s.id] ?? 0;
    if (mode === 'missing') return q === 0;
    if (mode === 'duplicates') return q >= 2;
    return q >= 1;
  };
  const list = stickers.filter(inMode);

  const titleByMode: Record<ExportMode, string> = {
    missing: `❌ *FIGURINHAS FALTANDO (${list.length})*`,
    duplicates: `🔁 *REPETIDAS PRA TROCA (${list.length})*`,
    have: `✅ *FIGURINHAS QUE TENHO (${list.length})*`,
  };

  const lines: string[] = [];
  lines.push('🏆 *Copa 2026*');
  if (authorName) lines.push(`👤 ${authorName}`);
  lines.push('');
  lines.push(titleByMode[mode]);
  lines.push('─────────────');
  lines.push('');

  // Helper pra rotular cada figurinha (com qty pra repetidas)
  const label = (s: Sticker): string => {
    const code = displayCode(s);
    if (mode === 'duplicates') {
      const q = qtyMap[s.id] ?? 0;
      const extras = q - 1;
      return extras > 1 ? `${code} ×${extras}` : code;
    }
    return code;
  };

  // Agrupa por seção
  const bySection = new Map<string, Sticker[]>();
  for (const s of list) {
    const key = s.team_code ?? '';
    const arr = bySection.get(key) ?? [];
    arr.push(s);
    bySection.set(key, arr);
  }

  // ===== Seções FWC (com sub-categorias) =====
  const fwc = bySection.get('FWC') ?? [];
  if (fwc.length > 0) {
    const intro = fwc.filter((s) => s.id === 'FWC-00');
    const copa = fwc.filter((s) => {
      const n = parseInt(s.number, 10);
      return n >= 1 && n <= 4;
    });
    const sedes = fwc.filter((s) => {
      const n = parseInt(s.number, 10);
      return n >= 5 && n <= 8;
    });
    const museu = fwc.filter((s) => {
      const n = parseInt(s.number, 10);
      return n >= 9 && n <= 19;
    });

    if (intro.length) {
      lines.push('*Somos 26* · pg. 0');
      lines.push(...chunkLines(intro.map(label)));
      lines.push('');
    }
    if (copa.length) {
      lines.push('*Copa 2026* · pg. 1');
      lines.push(...chunkLines(copa.map(label)));
      lines.push('');
    }
    if (sedes.length) {
      lines.push('*Bola e Países-Sede* · pg. 2-3');
      lines.push(...chunkLines(sedes.map(label)));
      lines.push('');
    }
    // (museu vai depois das seleções, conforme ordem do álbum)
  }

  // ===== 48 seleções =====
  for (const code of TEAM_ORDER) {
    const teamList = bySection.get(code);
    if (!teamList?.length) continue;
    const emoji = TEAM_EMOJI[code] ?? '';
    const pages = TEAM_PAGES[code];
    lines.push(`${emoji} *${code}* · pg. ${pages}`);
    lines.push(...chunkLines(teamList.map(label)));
    lines.push('');
  }

  // ===== História da Copa (FWC 9-19) =====
  const museu = (bySection.get('FWC') ?? []).filter((s) => {
    const n = parseInt(s.number, 10);
    return n >= 9 && n <= 19;
  });
  if (museu.length) {
    lines.push('*História da Copa* · pg. 106-109');
    lines.push(...chunkLines(museu.map(label)));
    lines.push('');
  }

  // ===== Extras =====
  const extras = bySection.get('EXTRA') ?? [];
  if (extras.length) {
    lines.push('*Extra Stickers* · pg. 110');
    lines.push(...chunkLines(extras.map(label)));
    lines.push('');
  }

  // ===== Extras CC =====
  const cc = bySection.get('CC') ?? [];
  if (cc.length) {
    lines.push('*CC* · pg. 111');
    lines.push(...chunkLines(cc.map(label)));
    lines.push('');
  }

  lines.push('— gerado pelo app Figurinha 📒⚽');
  return lines.join('\n');
}
