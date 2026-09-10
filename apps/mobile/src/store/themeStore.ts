import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getItemAsync, setItemAsync, deleteItemAsync } from '../lib/storage';

/** Preferência de tema escolhida pelo usuário — 'system' acompanha o SO. Espelha apps/web/src/store/themeStore.ts */
export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/**
 * Persiste via expo-secure-store (native) / localStorage (web, através de
 * lib/storage.ts) — reaproveita o mesmo armazenamento já usado pros tokens
 * de sessão, sem precisar de uma dependência nova (ex: AsyncStorage).
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'prodscore-theme',
      storage: createJSONStorage(() => ({
        getItem:    getItemAsync,
        setItem:    setItemAsync,
        removeItem: deleteItemAsync,
      })),
    },
  ),
);
