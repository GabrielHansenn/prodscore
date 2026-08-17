/**
 * Testes da store de tema (claro/escuro/sistema).
 * window.matchMedia é mockado (jsdom não implementa) — ver src/test/setup.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore, resolvedTheme } from '../store/themeStore';

/** Sobrescreve window.matchMedia para simular a preferência do SO nos testes */
function mockPrefersDark(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('themeStore', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
    useThemeStore.setState({ theme: 'system' });
    mockPrefersDark(false);
  });

  it('estado inicial é "system"', () => {
    expect(useThemeStore.getState().theme).toBe('system');
  });

  describe('resolvedTheme', () => {
    it('resolve "system" para "light" quando o SO prefere claro', () => {
      mockPrefersDark(false);
      expect(resolvedTheme(useThemeStore.getState())).toBe('light');
    });

    it('resolve "system" para "dark" quando o SO prefere escuro', () => {
      mockPrefersDark(true);
      expect(resolvedTheme(useThemeStore.getState())).toBe('dark');
    });

    it('ignora a preferência do SO quando o tema é explicitamente "light"', () => {
      mockPrefersDark(true);
      useThemeStore.setState({ theme: 'light' });
      expect(resolvedTheme(useThemeStore.getState())).toBe('light');
    });

    it('ignora a preferência do SO quando o tema é explicitamente "dark"', () => {
      mockPrefersDark(false);
      useThemeStore.setState({ theme: 'dark' });
      expect(resolvedTheme(useThemeStore.getState())).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('aplica a classe "dark" e color-scheme no <html> ao escolher escuro', () => {
      useThemeStore.getState().setTheme('dark');

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.style.colorScheme).toBe('dark');
      expect(useThemeStore.getState().theme).toBe('dark');
    });

    it('remove a classe "dark" ao escolher claro', () => {
      document.documentElement.classList.add('dark');

      useThemeStore.getState().setTheme('light');

      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('escolher "system" resolve conforme a preferência atual do SO', () => {
      mockPrefersDark(true);

      useThemeStore.getState().setTheme('system');

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(useThemeStore.getState().theme).toBe('system');
    });
  });
});
