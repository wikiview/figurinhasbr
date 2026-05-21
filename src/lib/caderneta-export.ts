import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Sticker } from './types';
import type { TradeMap } from '@/src/hooks/useTradeSlots';

export type CadernetaRow = {
  sticker: Sticker;
  qty: number;
  trade1Who: string;
  trade1What: string;
  trade2Who: string;
  trade2What: string;
};

export function buildRows(
  stickers: Sticker[],
  qtyMap: Record<string, number>,
  trades: TradeMap,
): CadernetaRow[] {
  return stickers.map((s) => {
    const entry = trades[s.id];
    return {
      sticker: s,
      qty: qtyMap[s.id] ?? 0,
      trade1Who: entry?.s1?.who ?? '',
      trade1What: entry?.s1?.what ?? '',
      trade2Who: entry?.s2?.who ?? '',
      trade2What: entry?.s2?.what ?? '',
    };
  });
}

function displayCode(s: Sticker): string {
  if (s.id === 'FWC-00') return '00';
  if (s.team_code === 'EXTRA') return s.number;
  return `${s.team_code ?? ''}${s.number}`;
}

function escapeCsvField(value: string): string {
  if (/[",;\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const HEADERS = [
  '#',
  'Nome',
  'Seleção',
  'Tenho',
  'Repetidas',
  'Troca 1 - Quem',
  'Troca 1 - Qual',
  'Troca 2 - Quem',
  'Troca 2 - Qual',
];

function rowValues(r: CadernetaRow): string[] {
  const have = r.qty >= 1 ? 'Sim' : 'Não';
  const reps = r.qty > 1 ? String(r.qty - 1) : '0';
  return [
    displayCode(r.sticker),
    r.sticker.player_name ?? '',
    r.sticker.team ?? '',
    have,
    reps,
    r.trade1Who,
    r.trade1What,
    r.trade2Who,
    r.trade2What,
  ];
}

export function buildCsv(rows: CadernetaRow[]): string {
  const lines: string[] = [];
  lines.push(HEADERS.map(escapeCsvField).join(','));
  for (const r of rows) {
    lines.push(rowValues(r).map(escapeCsvField).join(','));
  }
  // BOM pra Excel/Google Sheets reconhecerem UTF-8 com acento
  return '﻿' + lines.join('\r\n');
}

// HTML-as-XLS: Excel abre arquivos .xls que são na verdade tabelas HTML.
// Evita adicionar dependência pesada (xlsx/sheetjs ~600KB).
export function buildXlsHtml(rows: CadernetaRow[], title: string): string {
  const head = HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map((r) => {
      const cells = rowValues(r)
        .map((v) => `<td>${escapeHtml(v)}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:x="urn:schemas-microsoft-com:office:excel"
xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/><title>${escapeHtml(title)}</title></head>
<body>
<table border="1">
<thead><tr>${head}</tr></thead>
<tbody>${body}</tbody>
</table>
</body></html>`;
}

// Páginas oficiais do álbum por seleção/seção
const TEAM_PAGES: Record<string, string> = {
  FWC: '0-3, 106-109',
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
  EXTRA: '110', CC: '111',
};

const SECTION_NAMES: Record<string, string> = {
  FWC: 'Especiais FIFA',
  EXTRA: 'Esmaltadas (Bronze, Prata, Ouro)',
  CC: 'Coleção Coca-Cola',
};

function teamLabel(code: string, fallback: string): string {
  return SECTION_NAMES[code] ?? fallback ?? code;
}

export type PdfMeta = {
  title: string;
  subtitle: string;
  ownerName?: string;
  filterLabel: string;
  stats: { have: number; total: number; pct: number; dup: number; missing: number };
};

export function buildPdfHtml(rows: CadernetaRow[], meta: PdfMeta): string {
  // Agrupa por seleção mantendo a ordem do álbum (rows já vêm em display_order)
  const groups = new Map<string, CadernetaRow[]>();
  for (const r of rows) {
    const key = r.sticker.team_code ?? '—';
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const qrUrl =
    'https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&data=figurinha%3A%2F%2F';

  const sections = Array.from(groups.entries())
    .map(([code, list]) => {
      const teamName = teamLabel(code, list[0]?.sticker.team ?? code);
      const owned = list.filter((r) => r.qty >= 1).length;
      const pages = TEAM_PAGES[code];
      const flag = code in SECTION_NAMES ? '' : flagImg(code);

      const bodyRows = list
        .map((r) => {
          const have = r.qty >= 1;
          const reps = r.qty > 1 ? r.qty - 1 : 0;
          const rowClass = reps > 0 ? 'dup' : have ? 'have' : 'miss';
          return `<tr class="${rowClass}">
<td class="code">${escapeHtml(displayCode(r.sticker))}</td>
<td class="name">${escapeHtml(r.sticker.player_name ?? displayCode(r.sticker))}</td>
<td class="check">${have ? '<span class="checked">✓</span>' : '<span class="checkbox"></span>'}</td>
<td class="reps">${reps > 0 ? `<span class="repBadge">${reps}</span>` : ''}</td>
<td class="fill">${escapeHtml(r.trade1Who)}</td>
<td class="fill">${escapeHtml(r.trade1What)}</td>
<td class="fill">${escapeHtml(r.trade2Who)}</td>
<td class="fill">${escapeHtml(r.trade2What)}</td>
</tr>`;
        })
        .join('');

      return `<section class="team">
<div class="teamHeader">
  <div class="teamLeft">
    ${flag}
    <div class="teamName">${escapeHtml(teamName)}</div>
    ${pages ? `<span class="teamPages">pg. ${pages}</span>` : ''}
  </div>
  <div class="teamCount">${owned}/${list.length}</div>
</div>
<table>
<thead>
  <tr class="thHeadTop">
    <th rowspan="2" class="th-num">#</th>
    <th rowspan="2" class="th-name">Nome</th>
    <th rowspan="2" class="th-have">Tenho</th>
    <th rowspan="2" class="th-rep">Rep.</th>
    <th colspan="2" class="th-trade">TROCA 1</th>
    <th colspan="2" class="th-trade">TROCA 2</th>
  </tr>
  <tr class="thHeadBot">
    <th class="th-sub">Quem</th>
    <th class="th-sub">Qual</th>
    <th class="th-sub">Quem</th>
    <th class="th-sub">Qual</th>
  </tr>
</thead>
<tbody>${bodyRows}</tbody>
</table>
</section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(meta.title)}</title>
<style>
@page { size: A4; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; color: #0f172a; font-size: 10px; margin: 0; }

/* ===== Hero ===== */
.hero {
  position: relative;
  border-radius: 14px;
  padding: 16px 20px;
  color: #fff;
  background: linear-gradient(135deg, #16a34a 0%, #2563eb 35%, #ef4444 70%, #ec4899 100%);
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
  overflow: hidden;
}
.heroBadge {
  width: 48px; height: 48px; border-radius: 12px;
  background: rgba(255,255,255,0.18);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.35);
}
.heroText { flex: 1; min-width: 0; }
.heroTitle { font-size: 20px; font-weight: 800; margin: 0; letter-spacing: -0.3px; text-shadow: 0 1px 2px rgba(0,0,0,0.25); }
.heroOwner { font-size: 11px; opacity: 0.95; margin-top: 2px; font-weight: 600; }
.heroStats {
  font-size: 13px; font-weight: 700; margin-top: 6px;
  color: #fef9c3;
}
.heroStats .pct { font-size: 14px; font-weight: 800; color: #fff; }
.heroFilter {
  display: inline-block; margin-top: 6px; padding: 2px 10px;
  background: rgba(255,255,255,0.2); border-radius: 999px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
  border: 1px solid rgba(255,255,255,0.3);
}
.heroQr {
  background: #fff; padding: 6px; border-radius: 10px;
  text-align: center; flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.heroQr img { display: block; width: 70px; height: 70px; }
.heroQr .qrLabel { font-size: 7px; color: #475569; font-weight: 700; margin-top: 2px; letter-spacing: 0.3px; }

/* ===== Sections ===== */
section.team { margin-bottom: 12px; page-break-inside: auto; }
.teamHeader {
  display: flex; align-items: center; justify-content: space-between;
  background: linear-gradient(90deg, #fde4cf 0%, #fce7f3 100%);
  border-radius: 6px 6px 0 0;
  padding: 7px 12px;
  border: 1px solid #f3d2bc;
  border-bottom: none;
}
.teamLeft { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.teamFlag { width: 22px; height: 16px; border-radius: 2px; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.08); }
.teamName { font-size: 12px; font-weight: 800; color: #7c2d12; letter-spacing: 0.2px; }
.teamPages { font-size: 9px; font-weight: 600; color: #9a3412; opacity: 0.8; }
.teamCount { font-size: 11px; font-weight: 700; color: #7c2d12; }

/* ===== Table ===== */
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }

th, td { border: 1px solid #e2e8f0; padding: 4px 5px; vertical-align: middle; }
th { background: #f8fafc; font-weight: 700; font-size: 9px; color: #334155; text-transform: uppercase; letter-spacing: 0.3px; }
.thHeadTop th { border-bottom-width: 1px; }
.th-trade { background: #eff6ff; color: #1e40af; }
.th-sub { background: #f1f5f9; font-size: 8px; font-weight: 600; }

.th-num  { width: 7%; text-align: left; }
.th-name { width: 23%; text-align: left; }
.th-have { width: 7%; text-align: center; }
.th-rep  { width: 7%; text-align: center; }

td.code { font-weight: 800; color: #0b1d3a; font-size: 9px; white-space: nowrap; }
td.name { font-weight: 600; color: #0f172a; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
td.check, td.reps { text-align: center; }
td.fill { background: #fefefe; height: 18px; }

.checkbox { display: inline-block; width: 11px; height: 11px; border: 1.2px solid #cbd5e1; border-radius: 2px; }
.checked  { color: #16a34a; font-weight: 800; font-size: 13px; }
.repBadge {
  display: inline-block; min-width: 18px; padding: 1px 4px;
  background: #fef3c7; color: #92400e; font-weight: 800; font-size: 9px;
  border-radius: 4px; border: 1px solid #fde68a;
}
tr.have td.code, tr.have td.name, tr.have td.check, tr.have td.reps { background: #f0fdf4; }
tr.have td.name { color: #166534; font-weight: 700; }
tr.have td.code { color: #15803d; }
tr.dup td.code, tr.dup td.name, tr.dup td.check, tr.dup td.reps { background: #fffbeb; }
tr.dup td.name { color: #92400e; font-weight: 700; }
tr.dup td.code { color: #b45309; }
tr.miss td.code { color: #475569; }
tr.miss td.name { color: #64748b; }
/* td.fill (trade slots) sempre brancos pra ficar legível pra escrever */
td.fill { background: #ffffff !important; }

.footer { margin-top: 14px; padding-top: 8px; border-top: 1px dashed #cbd5e1; color: #94a3b8; font-size: 9px; text-align: center; font-weight: 500; }
</style>
</head>
<body>
<div class="hero">
  <div class="heroBadge">⚽</div>
  <div class="heroText">
    <h1 class="heroTitle">${escapeHtml(meta.title)}</h1>
    ${meta.ownerName ? `<div class="heroOwner">👤 ${escapeHtml(meta.ownerName)}</div>` : ''}
    <div class="heroStats">
      <span class="pct">${meta.stats.have}/${meta.stats.total}</span>
      &nbsp;·&nbsp; ${meta.stats.pct}% completo
      &nbsp;·&nbsp; ${meta.stats.dup} repetidas
      &nbsp;·&nbsp; ${meta.stats.missing} faltando
    </div>
    <span class="heroFilter">Filtro: ${escapeHtml(meta.filterLabel)} · ${rows.length} itens</span>
  </div>
  <div class="heroQr">
    <img src="${qrUrl}" alt="QR" />
    <div class="qrLabel">ABRIR NO APP</div>
  </div>
</div>

${sections}

<div class="footer">— gerado pelo app Figurinha · Copa do Mundo 2026™ · ${escapeHtml(formatDate())}</div>
</body>
</html>`;
}

function flagImg(teamCode: string): string {
  // Reusa o serviço flagcdn (mesmo que o app já usa em flags.ts)
  // Países sem ISO-2 confiável (SCO, ENG, KSA, UAE...) — caímos em texto
  const iso2 = teamCodeToIso2(teamCode);
  if (!iso2) {
    return `<span class="teamFlag" style="background:#e2e8f0; display:inline-block; text-align:center; font-size:9px; font-weight:800; color:#475569; line-height:16px;">${escapeHtml(teamCode)}</span>`;
  }
  return `<img class="teamFlag" src="https://flagcdn.com/w40/${iso2}.png" alt="${teamCode}"/>`;
}

function teamCodeToIso2(code: string): string | null {
  const map: Record<string, string> = {
    MEX: 'mx', RSA: 'za', KOR: 'kr', CZE: 'cz',
    CAN: 'ca', BIH: 'ba', QAT: 'qa', SUI: 'ch',
    BRA: 'br', MAR: 'ma', HAI: 'ht', SCO: 'gb-sct',
    USA: 'us', PAR: 'py', AUS: 'au', TUR: 'tr',
    GER: 'de', CUW: 'cw', CIV: 'ci', ECU: 'ec',
    NED: 'nl', JPN: 'jp', SWE: 'se', TUN: 'tn',
    BEL: 'be', EGY: 'eg', IRN: 'ir', NZL: 'nz',
    ESP: 'es', CPV: 'cv', KSA: 'sa', URU: 'uy',
    FRA: 'fr', SEN: 'sn', IRQ: 'iq', NOR: 'no',
    ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo',
    POR: 'pt', COD: 'cd', UZB: 'uz', COL: 'co',
    ENG: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa',
  };
  return map[code] ?? null;
}

function formatDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

async function writeAndShare(
  filename: string,
  content: string,
  mimeType: string,
  uti?: string,
) {
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Compartilhamento indisponível neste dispositivo');
  }
  await Sharing.shareAsync(path, { mimeType, UTI: uti, dialogTitle: filename });
}

export async function exportCsv(rows: CadernetaRow[]) {
  const stamp = timestamp();
  const csv = buildCsv(rows);
  await writeAndShare(`caderneta-${stamp}.csv`, csv, 'text/csv', 'public.comma-separated-values-text');
}

export async function exportXls(rows: CadernetaRow[], title: string) {
  const stamp = timestamp();
  const html = buildXlsHtml(rows, title);
  await writeAndShare(
    `caderneta-${stamp}.xls`,
    html,
    'application/vnd.ms-excel',
    'com.microsoft.excel.xls',
  );
}

export async function exportPdf(rows: CadernetaRow[], meta: PdfMeta) {
  const html = buildPdfHtml(rows, meta);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Compartilhamento indisponível neste dispositivo');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Caderneta.pdf',
  });
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}`;
}
