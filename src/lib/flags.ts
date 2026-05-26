/**
 * Mapeamento código de país 3-letras → ISO alpha-2 (lowercase) pra montar URLs do flagcdn.com.
 * Cobre as 48 seleções do álbum da Copa 2026 + extras pra futuros álbuns.
 *
 * Casos especiais: ENG/SCO usam subdivisões `gb-eng` e `gb-sct`.
 */
export const COUNTRY_TO_ISO2: Record<string, string> = {
  // CONMEBOL
  ARG: 'ar', BRA: 'br', URU: 'uy', COL: 'co', ECU: 'ec', PAR: 'py',
  PER: 'pe', CHI: 'cl', BOL: 'bo', VEN: 've',
  // CONCACAF
  CAN: 'ca', MEX: 'mx', USA: 'us', CRC: 'cr', PAN: 'pa', JAM: 'jm',
  HAI: 'ht', CUW: 'cw',
  // UEFA
  FRA: 'fr', GER: 'de', ESP: 'es', POR: 'pt', ENG: 'gb-eng', ITA: 'it',
  NED: 'nl', BEL: 'be', CRO: 'hr', POL: 'pl', SUI: 'ch', AUT: 'at',
  DEN: 'dk', TUR: 'tr', NOR: 'no', SCO: 'gb-sct', SWE: 'se', CZE: 'cz',
  BIH: 'ba', UKR: 'ua', WAL: 'gb-wls', NIR: 'gb-nir', IRL: 'ie',
  // AFC
  JPN: 'jp', KOR: 'kr', IRN: 'ir', KSA: 'sa', AUS: 'au', UZB: 'uz',
  JOR: 'jo', QAT: 'qa', IRQ: 'iq',
  // CAF
  MAR: 'ma', EGY: 'eg', TUN: 'tn', ALG: 'dz', SEN: 'sn', CIV: 'ci',
  NGA: 'ng', GHA: 'gh', CMR: 'cm', RSA: 'za', CPV: 'cv', COD: 'cd',
  // OFC
  NZL: 'nz',
};

export type FlagWidth = 80 | 160 | 320;

export function flagUrl(fifaCode: string, width: FlagWidth = 160): string | null {
  const iso2 = COUNTRY_TO_ISO2[fifaCode];
  if (!iso2) return null;
  return `https://flagcdn.com/w${width}/${iso2}.png`;
}
