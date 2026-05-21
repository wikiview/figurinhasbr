import { useResolvedTheme } from '@/src/hooks/usePreferences';
import { darkTheme, lightTheme, type ThemeColors } from '@/src/lib/theme';

export function useTheme(): ThemeColors {
  const name = useResolvedTheme();
  return name === 'dark' ? darkTheme : lightTheme;
}
