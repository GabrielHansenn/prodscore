import { create } from 'zustand';
import { AssuranceLevel, type User } from '@prodscore/shared';
import {
  setAuthSession,
  signOut,
  getSession,
  getAssuranceLevel,
  listTOTPFactors,
  verifyTOTPChallenge,
} from '../lib/supabase.js';
import { api } from '../services/api.js';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Session {
  accessToken: string;
  refreshToken: string;
}

/** Resposta de POST /auth/login (o perfil é buscado depois, em /users/me) */
interface LoginResponse {
  mfaRequired: boolean;
  sessao:      { accessToken: string; refreshToken: string };
}

/** Resposta de POST /auth/register — `sessao` só vem quando a auto-confirmação está ativa */
interface RegisterResponse {
  mensagem: string;
  sessao?:  { accessToken: string; refreshToken: string };
}

/**
 * Resultado de um cadastro BEM-SUCEDIDO:
 * - 'authenticated' → conta criada e sessão aberta
 * - 'confirm_email' → conta criada, aguardando confirmação do e-mail
 * Falhas (e-mail já cadastrado, validação...) lançam o erro da API.
 */
export type RegisterResult = 'authenticated' | 'confirm_email';

interface AuthState {
  /** Perfil completo do usuário autenticado (inclui dados de gamificação) */
  user: User | null;
  /** Tokens de sessão Supabase */
  session: Session | null;
  /** True apenas durante o check inicial de sessão (loadSession) — usado pelas route guards */
  isInitializing: boolean;
  /** True durante operações disparadas pelo usuário (login, register) */
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Nível de garantia (AAL) da sessão atual — null enquanto não autenticado */
  assuranceLevel: AssuranceLevel | null;
  /** True entre o login com senha (aal1) e a confirmação do código TOTP (aal2) */
  mfaPending: boolean;
  /** ID do fator TOTP pendente de verificação no step-up de login */
  mfaFactorId: string | null;

  /**
   * Autentica com e-mail OU nome de usuário, e senha.
   * Lança 'MFA_REQUIRED' se o usuário tiver 2FA ativo — a UI deve redirecionar
   * para a tela de verificação e chamar `verifyMfaChallenge` na sequência.
   */
  login: (login: string, password: string) => Promise<void>;
  /**
   * Registra novo usuário via API. Resolve só quando a conta foi realmente
   * criada (ver RegisterResult); qualquer falha é lançada.
   */
  register: (username: string, email: string, password: string) => Promise<RegisterResult>;
  /** Encerra a sessão e limpa o estado */
  logout: () => Promise<void>;
  /** Restaura sessão existente do localStorage na montagem da aplicação */
  loadSession: () => Promise<void>;
  /** Limpa o estado sem chamar a API (usado pelo interceptor de 401) */
  clearSession: () => void;
  /** Confirma o código TOTP do step-up de login e eleva a sessão para aal2 */
  verifyMfaChallenge: (code: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set, get) => ({
  user:            null,
  session:         null,
  isInitializing:  true,   // começa true para evitar flash de tela de login
  isLoading:       false,
  isAuthenticated: false,
  assuranceLevel:  null,
  mfaPending:      false,
  mfaFactorId:     null,

  login: async (login, password) => {
    set({ isLoading: true });
    try {
      // Pela API (e não supabase.auth.signInWithPassword direto): é ela que
      // aceita o NOME DE USUÁRIO e acha o e-mail da conta no servidor, sem
      // nunca mandar o e-mail de ninguém para o navegador. Erros da API
      // (senha errada, e-mail não confirmado) sobem com o código para a tela.
      const { data: res } = await api.post<LoginResponse>('/auth/login', { login, password });

      // Instala no cliente Supabase a sessão criada pela API — dali em diante
      // ele renova o token e o 2FA abaixo funciona como antes
      const { data: supabaseSession, error } = await setAuthSession(res.sessao.accessToken, res.sessao.refreshToken);

      if (error || !supabaseSession) {
        throw new Error(error ?? 'Erro ao iniciar sessão.');
      }

      // Verifica se o usuário tem 2FA ativo — se sim, a sessão fica em aal1
      // até o step-up ser concluído com `verifyMfaChallenge`.
      const { currentLevel, nextLevel } = await getAssuranceLevel();

      if (currentLevel === AssuranceLevel.AAL1 && nextLevel === AssuranceLevel.AAL2) {
        const { factors } = await listTOTPFactors();
        const activeFactor = factors[0] ?? null;

        set({
          assuranceLevel: AssuranceLevel.AAL1,
          mfaPending:     true,
          mfaFactorId:    activeFactor?.id ?? null,
          isLoading:      false,
        });
        throw new Error('MFA_REQUIRED');
      }

      // Busca o perfil completo com dados de gamificação
      const { data } = await api.get<{ usuario: User }>('/users/me');

      set({
        user:            data.usuario,
        session:         {
          accessToken:  supabaseSession.access_token,
          refreshToken: supabaseSession.refresh_token,
        },
        assuranceLevel:  currentLevel ?? AssuranceLevel.AAL1,
        mfaPending:      false,
        isAuthenticated: true,
        isLoading:       false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  verifyMfaChallenge: async (code) => {
    const { mfaFactorId } = get();

    if (!mfaFactorId) {
      throw new Error('Nenhuma verificação de 2FA pendente.');
    }

    set({ isLoading: true });
    try {
      const { data, error } = await verifyTOTPChallenge(mfaFactorId, code);

      if (error || !data) {
        throw new Error(error ?? 'Código inválido. Tente novamente.');
      }

      // Busca o perfil completo agora que a sessão está em aal2
      const { data: profileData } = await api.get<{ usuario: User }>('/users/me');

      set({
        user:            profileData.usuario,
        session:         {
          accessToken:  data.accessToken,
          refreshToken: data.refreshToken,
        },
        assuranceLevel:  AssuranceLevel.AAL2,
        mfaPending:      false,
        mfaFactorId:     null,
        isAuthenticated: true,
        isLoading:       false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true });
    try {
      // Pela API (e não supabase.auth.signUp direto): é ela que valida as
      // regras e responde 409 para e-mail/username já cadastrados. Qualquer
      // status de erro faz o axios lançar — nunca chega ao retorno de sucesso.
      const { data: res } = await api.post<RegisterResponse>('/auth/register', { username, email, password });

      if (!res.sessao) {
        // Conta criada de verdade, aguardando confirmação do e-mail
        set({ isLoading: false });
        return 'confirm_email';
      }

      // Auto-confirmação ativa: instala a sessão no cliente Supabase e busca
      // o perfil criado pelo trigger
      const { data: supabaseSession, error } = await setAuthSession(res.sessao.accessToken, res.sessao.refreshToken);
      if (error || !supabaseSession) throw new Error(error ?? 'Sessão inválida.');

      const { data } = await api.get<{ usuario: User }>('/users/me');

      set({
        user:            data.usuario,
        session:         {
          accessToken:  supabaseSession.access_token,
          refreshToken: supabaseSession.refresh_token,
        },
        // Conta recém-criada nunca tem fator MFA cadastrado ainda
        assuranceLevel:  AssuranceLevel.AAL1,
        isAuthenticated: true,
        isLoading:       false,
      });
      return 'authenticated';
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Mesmo em erro na API, limpa o estado local
    }
    await signOut();
    set({
      user:            null,
      session:         null,
      isAuthenticated: false,
      isLoading:       false,
      assuranceLevel:  null,
      mfaPending:      false,
      mfaFactorId:     null,
    });
  },

  loadSession: async () => {
    try {
      const session = await getSession();

      if (!session) {
        set({ isInitializing: false });
        return;
      }

      // Sessão válida — busca perfil atualizado da API e o AAL atual
      const [{ data }, { currentLevel }] = await Promise.all([
        api.get<{ usuario: User }>('/users/me'),
        getAssuranceLevel(),
      ]);

      set({
        user:            data.usuario,
        session:         {
          accessToken:  session.access_token,
          refreshToken: session.refresh_token,
        },
        assuranceLevel:  currentLevel ?? AssuranceLevel.AAL1,
        isAuthenticated: true,
        isInitializing:  false,
      });
    } catch {
      // Sessão expirada ou perfil não encontrado
      set({
        user:            null,
        session:         null,
        isAuthenticated: false,
        isInitializing:  false,
        assuranceLevel:  null,
      });
    }
  },

  clearSession: () => {
    set({
      user:            null,
      session:         null,
      isAuthenticated: false,
      isLoading:       false,
      assuranceLevel:  null,
      mfaPending:      false,
      mfaFactorId:     null,
    });
  },
}));

// ---------------------------------------------------------------------------
// Seletores
// ---------------------------------------------------------------------------

/**
 * Retorna true se a sessão autenticada ainda não tem o segundo fator (aal2)
 * verificado — usado pelos guards de rota/ação que exigem 2FA confirmado.
 *
 * Uso: `const precisaVerificar = useAuthStore(requiresMFAVerification);`
 */
export function requiresMFAVerification(state: AuthState): boolean {
  return state.isAuthenticated && state.assuranceLevel !== AssuranceLevel.AAL2;
}
