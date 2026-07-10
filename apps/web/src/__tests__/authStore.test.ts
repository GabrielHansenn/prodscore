/**
 * Testes da store de autenticação (Zustand).
 * Supabase é mockado para isolar a lógica de auth da rede.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock do Supabase (deve ser declarado antes do import da store)
// ---------------------------------------------------------------------------

const mockSignIn  = vi.fn();
const mockSignUp  = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignIn,
      signUp:             mockSignUp,
      signOut:            mockSignOut,
      getSession:         mockGetSession,
      getUser:            mockGetUser,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq:     vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) })),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
    })),
  },
}));

import { useAuthStore } from '../store/authStore';

// ---------------------------------------------------------------------------
// Dados de teste
// ---------------------------------------------------------------------------

const mockUser = {
  id:             'user-1',
  username:       'gabriel',
  email:          'gabriel@test.com',
  avatarUrl:      null,
  bio:            null,
  level:          1,
  totalPoints:    0,
  currentStreak:  0,
  longestStreak:  0,
  lastActiveDate: null,
  createdAt:      '2025-01-01T00:00:00.000Z',
};

const mockSession = {
  access_token:  'access-token-abc',
  refresh_token: 'refresh-token-xyz',
  expires_at:    9999999999,
  user: {
    id:    'user-1',
    email: 'gabriel@test.com',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reseta o estado da store Zustand entre testes */
function resetStore() {
  useAuthStore.setState({
    user:            null,
    session:         null,
    isAuthenticated: false,
    isLoading:       false,
  });
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe('login', () => {
    it('deve definir user e session no estado após login bem-sucedido', async () => {
      mockSignIn.mockResolvedValue({ data: { session: mockSession, user: mockSession.user }, error: null });

      // Mock do perfil retornado pelo Supabase após login
      const { supabase } = await import('../lib/supabase.js');
      (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
          })),
        })),
      });

      await useAuthStore.getState().login('gabriel@test.com', 'senha123');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).not.toBeNull();
      expect(state.session).not.toBeNull();
    });

    it('deve lançar erro quando credenciais são inválidas', async () => {
      mockSignIn.mockResolvedValue({
        data:  { session: null, user: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        useAuthStore.getState().login('wrong@test.com', 'wrongpassword'),
      ).rejects.toThrow();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('deve definir isLoading=false após login (com sucesso ou erro)', async () => {
      mockSignIn.mockResolvedValue({
        data:  { session: null, user: null },
        error: { message: 'Erro' },
      });

      try {
        await useAuthStore.getState().login('x@x.com', 'x');
      } catch {
        // esperado
      }

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('deve limpar user e session no estado', async () => {
      // Pré-popula o estado com sessão ativa
      useAuthStore.setState({
        user:            mockUser,
        session:         mockSession as unknown as ReturnType<typeof useAuthStore.getState>['session'],
        isAuthenticated: true,
        isLoading:       false,
      });

      mockSignOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
    });
  });

  describe('estado inicial', () => {
    it('deve iniciar com isAuthenticated=false e user=null', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
    });
  });
});
