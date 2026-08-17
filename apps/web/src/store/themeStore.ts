import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Preferência de tema escolhida pelo usuário — 'system' acompanha o SO */
export type Theme = 'light' | 'dark' | 'system';

/** Tema efetivamente aplicado na tela (resolve 'system' em light/dark) */
export type ResolvedTheme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/** Resolve 'system' consultando a preferência do SO no momento da chamada */
function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Aplica o tema resolvido no elemento raiz — classe `dark` do Tailwind
 * (darkMode: 'class') e a propriedade CSS `color-scheme` (conserta
 * scrollbars, inputs nativos e autofill do navegador nos dois temas).
 */
function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      // O script inline em index.html já aplicou o tema correto antes do
      // primeiro render — este valor inicial só precisa estar coerente com
      // o padrão daquele script (evita re-hidratar para um estado diferente).
      theme: 'system',

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    { name: 'prodscore-theme' },
  ),
);

/**
 * Seletor: tema efetivamente exibido (resolve 'system').
 * Uso: `const resolved = useThemeStore(resolvedTheme);`
 */
export function resolvedTheme(state: ThemeStore): ResolvedTheme {
  return resolveTheme(state.theme);
}

// Acompanha mudanças na preferência do sistema operacional em tempo real
// (ex: usuário troca o tema do SO com o app aberto) quando theme === 'system'.
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().theme === 'system') applyTheme('system');
  });
}
