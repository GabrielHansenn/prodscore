import { useColorScheme } from 'react-native';
import { useThemeStore } from '../store/themeStore';
import { lightColors, darkColors, type ColorPalette } from '../constants/theme';

export type ResolvedTheme = 'light' | 'dark';

/**
 * Tema efetivamente exibido, resolvendo 'system' pela preferência do SO.
 * `useColorScheme()` já é reativo (re-renderiza sozinho quando o SO muda de
 * tema com o app aberto) — não precisa de listener manual.
 */
export function useResolvedTheme(): ResolvedTheme {
  const theme = useThemeStore((s) => s.theme);
  const systemScheme = useColorScheme();
  if (theme === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return theme;
}

/** Paleta de cores reativa ao tema atual — substitui o import estático de `COLORS`. */
export function useThemeColors(): ColorPalette {
  const resolved = useResolvedTheme();
  return resolved === 'dark' ? darkColors : lightColors;
}
