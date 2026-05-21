import { useColorScheme } from 'react-native';
import { usePrefsContext } from '@/src/providers/PreferencesProvider';

export type { CardMode, ThemePref, ViewMode } from '@/src/providers/PreferencesProvider';

export function useCardMode() {
  const { cardMode, setCardMode } = usePrefsContext();
  return { mode: cardMode, setMode: setCardMode };
}

export function useThemePref() {
  const { themePref, setThemePref } = usePrefsContext();
  return { pref: themePref, setPref: setThemePref };
}

export function useViewMode() {
  const { viewMode, setViewMode } = usePrefsContext();
  return { mode: viewMode, setMode: setViewMode };
}

export function useResolvedTheme(): 'light' | 'dark' {
  const { themePref } = usePrefsContext();
  const system = useColorScheme();
  if (themePref === 'system') return system === 'dark' ? 'dark' : 'light';
  return themePref;
}
