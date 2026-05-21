export type ThemeColors = {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderSubtle: string;
  primary: string;
  primaryText: string;
  accent: string;
  // estados das figurinhas — mantemos vibrantes nos dois temas
  haveBg: string;
  haveBorder: string;
  haveText: string;
  dupBg: string;
  dupBorder: string;
  dupText: string;
  // "scan-dup": mesmo código apareceu 2+ vezes no scan atual (laranja)
  scanDupBg: string;
  scanDupBorder: string;
  scanDupText: string;
  shinyBg: string;
  shinyBorder: string;
  // backdrop do modal
  backdrop: string;
  // tab bar
  tabBg: string;
  tabBorder: string;
};

export const lightTheme: ThemeColors = {
  bg: '#f8fafc',
  bgElevated: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  border: '#e2e8f0',
  borderSubtle: '#f1f5f9',
  primary: '#0a7ea4',
  primaryText: '#ffffff',
  accent: '#0b1d3a',
  haveBg: '#f0fdf4',
  haveBorder: '#86efac',
  haveText: '#15803d',
  dupBg: '#fffbeb',
  dupBorder: '#fcd34d',
  dupText: '#92400e',
  scanDupBg: '#fff1e6',
  scanDupBorder: '#fb923c',
  scanDupText: '#9a3412',
  shinyBg: '#fffbeb',
  shinyBorder: '#facc15',
  backdrop: 'rgba(2,6,23,0.65)',
  tabBg: '#ffffff',
  tabBorder: '#e2e8f0',
};

export const darkTheme: ThemeColors = {
  bg: '#0a0f1a',
  bgElevated: '#111827',
  surface: '#111827',
  surfaceAlt: '#1f2937',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  border: '#1f2937',
  borderSubtle: '#1e293b',
  primary: '#38bdf8',
  primaryText: '#0a0f1a',
  accent: '#1e293b',
  haveBg: '#052e16',
  haveBorder: '#16a34a',
  haveText: '#86efac',
  dupBg: '#3f2a04',
  dupBorder: '#f59e0b',
  dupText: '#fcd34d',
  scanDupBg: '#3a1d05',
  scanDupBorder: '#fb923c',
  scanDupText: '#fdba74',
  shinyBg: '#3f2a04',
  shinyBorder: '#facc15',
  backdrop: 'rgba(0,0,0,0.75)',
  tabBg: '#0a0f1a',
  tabBorder: '#1f2937',
};

export function getTheme(name: 'light' | 'dark'): ThemeColors {
  return name === 'dark' ? darkTheme : lightTheme;
}
