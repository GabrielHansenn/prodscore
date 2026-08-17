/**
 * Testes da store de autenticação (Zustand).
 * Supabase é mockado para isolar a lógica de auth da rede.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock do Supabase (deve ser declarado antes do import da store)
//
// Usa vi.hoisted porque vi.mock é hoisted para o topo do arquivo pelo Vitest —
// sem isso, as referências às constantes de mock dentro da factory falhariam
// com "Cannot access before initialization".
// ---------------------------------------------------------------------------

const {
  mockSignIn,
  mockSignUp,
  mockSignOut,
  mockGetSession,
  mockGetUser,
  mockGetAssuranceLevel,
  mockListTOTPFactors,
  mockVerifyTOTPChallenge,
  mockApiGet,
  mockApiPost,
} = vi.hoisted(() => ({
  mockSignIn:              vi.fn(),
  mockSignUp:              vi.fn(),
  mockSignOut:             vi.fn(),
  mockGetSession:          vi.fn(),
  mockGetUser:             vi.fn(),
  mockGetAssuranceLevel:   vi.fn(),
  mockListTOTPFactors:     vi.fn(),
  mockVerifyTOTPChallenge: vi.fn(),
  mockApiGet:              vi.fn(),
  mockApiPost:             vi.fn(),
}));

// Isola authStore da rede real (axios) — chamadas a /users/me e /auth/logout
// passam a resolver com os dados de teste em vez de tentar uma requisição HTTP.
vi.mock('../services/api.js', () => ({
  api: {
    get:  mockApiGet,
    post: mockApiPost,
  },
}));

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
  // Reimplementações finas equivalentes às de lib/supabase.ts, delegando aos
  // mocks acima — evita depender do módulo real (que exige env vars do Vite).
  signIn: async (email: string, password: string) => {
    const { data, error } = await mockSignIn({ email, password });
    if (error) return { data: null, error: error.message as string };
    return { data: data.session, error: null };
  },
  signUp: async (email: string, password: string, username: string) => {
    const { data, error } = await mockSignUp({ email, password, options: { data: { username } } });
    if (error) return { data: null, error: error.message as string };
    return { data: data.session, error: null };
  },
  signOut: async () => {
    const { error } = await mockSignOut();
    if (error) return { data: null, error: error.message as string };
    return { data: null, error: null };
  },
  getSession: async () => {
    const { data, error } = await mockGetSession();
    if (error || !data.session) return null;
    return data.session;
  },
  // Funções de MFA — mockadas diretamente pois o authStore as importa por nome
  getAssuranceLevel:   mockGetAssuranceLevel,
  listTOTPFactors:     mockListTOTPFactors,
  verifyTOTPChallenge: mockVerifyTOTPChallenge,
}));

import { AssuranceLevel } from '@prodscore/shared';
import { useAuthStore, requiresMFAVerification } from '../store/authStore';

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
  streakFreezes:  0,
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
    assuranceLevel:  null,
    mfaPending:      false,
    mfaFactorId:     null,
  });
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();

    // Padrão: usuário sem 2FA ativo — currentLevel aal1 e sem próximo nível.
    // Testes de MFA sobrescrevem este mock quando precisam simular 2FA ativo.
    mockGetAssuranceLevel.mockResolvedValue({ currentLevel: AssuranceLevel.AAL1, nextLevel: null, error: null });
    mockListTOTPFactors.mockResolvedValue({ factors: [], error: null });

    // Padrão: GET /users/me retorna o perfil de teste; POST resolve vazio
    mockApiGet.mockResolvedValue({ data: { usuario: mockUser } });
    mockApiPost.mockResolvedValue({ data: {} });
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

    it('deve iniciar com assuranceLevel=null e mfaPending=false', () => {
      const state = useAuthStore.getState();
      expect(state.assuranceLevel).toBeNull();
      expect(state.mfaPending).toBe(false);
    });
  });

  describe('MFA / AAL', () => {
    it('deve marcar mfaPending e lançar MFA_REQUIRED quando o usuário tem 2FA ativo', async () => {
      mockSignIn.mockResolvedValue({ data: { session: mockSession, user: mockSession.user }, error: null });
      mockGetAssuranceLevel.mockResolvedValue({
        currentLevel: AssuranceLevel.AAL1,
        nextLevel:    AssuranceLevel.AAL2,
        error:        null,
      });
      mockListTOTPFactors.mockResolvedValue({
        factors: [{ id: 'factor-1', friendlyName: 'ProdScore', status: 'verified', createdAt: '2025-01-01T00:00:00.000Z' }],
        error:   null,
      });

      await expect(
        useAuthStore.getState().login('gabriel@test.com', 'senha123'),
      ).rejects.toThrow('MFA_REQUIRED');

      const state = useAuthStore.getState();
      expect(state.mfaPending).toBe(true);
      expect(state.assuranceLevel).toBe(AssuranceLevel.AAL1);
      expect(state.mfaFactorId).toBe('factor-1');
      // Ainda não deve estar autenticado — falta o step-up
      expect(state.isAuthenticated).toBe(false);
      // Não deve ter buscado o perfil antes de completar o 2FA
      expect(mockApiGet).not.toHaveBeenCalled();
    });

    it('login sem 2FA ativo deve autenticar direto com assuranceLevel=aal1', async () => {
      mockSignIn.mockResolvedValue({ data: { session: mockSession, user: mockSession.user }, error: null });
      // Mocks padrão do beforeEach já simulam "sem 2FA" (nextLevel: null)

      await useAuthStore.getState().login('gabriel@test.com', 'senha123');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.assuranceLevel).toBe(AssuranceLevel.AAL1);
      expect(state.mfaPending).toBe(false);
    });

    it('verifyMfaChallenge deve elevar a sessão para aal2 e autenticar o usuário', async () => {
      // Simula o estado deixado por um login com step-up pendente
      useAuthStore.setState({ mfaPending: true, mfaFactorId: 'factor-1', assuranceLevel: AssuranceLevel.AAL1 });

      mockVerifyTOTPChallenge.mockResolvedValue({
        data:  { accessToken: 'novo-access-token', refreshToken: 'novo-refresh-token' },
        error: null,
      });

      await useAuthStore.getState().verifyMfaChallenge('123456');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.assuranceLevel).toBe(AssuranceLevel.AAL2);
      expect(state.mfaPending).toBe(false);
      expect(state.mfaFactorId).toBeNull();
      expect(state.session?.accessToken).toBe('novo-access-token');
    });

    it('verifyMfaChallenge deve lançar erro com código inválido e manter mfaPending', async () => {
      useAuthStore.setState({ mfaPending: true, mfaFactorId: 'factor-1', assuranceLevel: AssuranceLevel.AAL1 });

      mockVerifyTOTPChallenge.mockResolvedValue({
        data:  null,
        error: 'Invalid TOTP code entered',
      });

      await expect(useAuthStore.getState().verifyMfaChallenge('000000')).rejects.toThrow();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });

    it('verifyMfaChallenge deve lançar erro quando não há verificação pendente', async () => {
      await expect(useAuthStore.getState().verifyMfaChallenge('123456')).rejects.toThrow();
    });

    describe('requiresMFAVerification', () => {
      it('deve retornar false quando não autenticado', () => {
        expect(requiresMFAVerification(useAuthStore.getState())).toBe(false);
      });

      it('deve retornar true quando autenticado em aal1', () => {
        useAuthStore.setState({ isAuthenticated: true, assuranceLevel: AssuranceLevel.AAL1 });
        expect(requiresMFAVerification(useAuthStore.getState())).toBe(true);
      });

      it('deve retornar false quando autenticado em aal2', () => {
        useAuthStore.setState({ isAuthenticated: true, assuranceLevel: AssuranceLevel.AAL2 });
        expect(requiresMFAVerification(useAuthStore.getState())).toBe(false);
      });
    });
  });
});
