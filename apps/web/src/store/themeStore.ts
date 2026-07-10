import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  toggle: () => void;
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'light',
      toggle: () =>
        set((s) => {
          const next: Theme = s.theme === 'light' ? 'dark' : 'light';
          applyTheme(next);
          return { theme: next };
        }),
    }),
    { name: 'prodscore-theme' },
  ),
);

// Aplica o tema antes do primeiro render para evitar flash
(function initTheme() {
  try {
    const raw = localStorage.getItem('prodscore-theme');
    if (raw) {
      const parsed = JSON.parse(raw) as { state: { theme: Theme } };
      applyTheme(parsed.state.theme);
    }
  } catch { /* ignora */ }
})();
