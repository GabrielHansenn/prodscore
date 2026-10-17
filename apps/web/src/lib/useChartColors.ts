import { useThemeStore, resolvedTheme } from '../store/themeStore.js';

/**
 * Cores dos gráficos (Recharts recebe cor em propriedade, não em classe do
 * Tailwind) — acompanham o tema claro/escuro e a paleta da marca.
 */
export function useChartColors() {
  const dark = useThemeStore(resolvedTheme) === 'dark';
  return {
    brand:        dark ? '#a78bfa' : '#7c3aed',
    lime:         dark ? '#a3e635' : '#65a30d',
    amber:        dark ? '#fbbf24' : '#f59e0b',
    grid:         dark ? '#312f5e' : '#e5e7eb',
    axis:         dark ? '#8f8fb8' : '#6b7280',
    tooltipBg:    dark ? '#1c1b32' : '#ffffff',
    tooltipBorder: dark ? '#312f5e' : '#e5e7eb',
    tooltipText:  dark ? '#f9fafb' : '#111827',
  };
}
