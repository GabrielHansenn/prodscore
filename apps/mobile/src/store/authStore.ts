import { create } from 'zustand';
import * as SecureStore from '../lib/storage';
import { MFAFactorStatus, type User } from '@prodscore/shared';
import { api, TOKEN_KEY, REFRESH_TOKEN_KEY } from '../services/api';
import { verifyMfaCode, getMfaFactors } from '../services/mfa.service';
import { decodeJwtAal } from '../lib/jwt';

interface LoginResponse {
  mfaRequired: boolean;
  factorId?:   string | null;
  sessao:      { accessToken: string; refreshToken: string };
  usuario?:    User;
}

/**
 * Resultado de um cadastro BEM-SUCEDIDO (espelho do web):
 * - 'authenticated' → conta criada e sessão aberta
 * - 'confirm_email' → conta criada, aguardando confirmação do e-mail
 * Falhas (e-mail já cadastrado, validação...) lançam o erro da API.
 */
export type RegisterResult = 'authenticated' | 'confirm_email';

interface AuthState {
  user:            User | null;
  accessToken:     string | null;
  isLoading:       boolean;
  isAuthenticated: boolean;
  /** True entre o login com senha (aal1) e a confirmação do código TOTP (aal2) */
  mfaPending:      boolean;
  /** ID do fator TOTP pendente de verificação no step-up de login */
  mfaFactorId:     string | null;

  /**
   * Autentica com e-mail OU nome de usuário, e senha, via POST /auth/login
   * (a API acha o e-mail da conta no servidor).
   * Se a conta tiver 2FA ativo, marca `mfaPending` em vez de autenticar —
   * chame `verifyMfaChallenge` na sequência com o código do autenticador.
   */
  login:              (login: string, password: string) => Promise<void>;
  /** Confirma o código TOTP do step-up de login e eleva a sessão para aal2 */
  verifyMfaChallenge: (code: string) => Promise<void>;
  /**
   * Registra novo usuário via POST /auth/register. Resolve só quando a conta
   * foi realmente criada (ver RegisterResult); qualquer falha é lançada.
   */
  register:    (username: string, email: string, password: string) => Promise<RegisterResult>;
  /** Encerra a sessão e limpa tokens do SecureStore */
  logout:      () => Promise<void>;
  /** Restaura sessão a partir do SecureStore na montagem do app */
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:            null,
  accessToken:     null,
  isLoading:       true,
  isAuthenticated: false,
  mfaPending:      false,
  mfaFactorId:     null,

  login: async (login, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { login, password });

      // Guarda os tokens mesmo em aal1 pendente — necessários pra chamar
      // /auth/mfa/verify no step-up (ver mfa.service.ts). São substituídos
      // pelos tokens finais em aal2 assim que a verificação for concluída.
      await SecureStore.setItemAsync(TOKEN_KEY,         data.sessao.accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.sessao.refreshToken);

      if (data.mfaRequired) {
        set({
          accessToken:     data.sessao.accessToken,
          mfaPending:      true,
          mfaFactorId:     data.factorId ?? null,
          isAuthenticated: false,
          isLoading:       false,
        });
        return;
      }

      set({
        user:            data.usuario ?? null,
        accessToken:     data.sessao.accessToken,
        isAuthenticated: true,
        mfaPending:      false,
        mfaFactorId:     null,
        isLoading:       false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  verifyMfaChallenge: async (code) => {
    const { mfaFactorId } = get();
    if (!mfaFactorId) throw new Error('Nenhuma verificação pendente.');

    set({ isLoading: true });
    try {
      const session = await verifyMfaCode(mfaFactorId, code);

      await SecureStore.setItemAsync(TOKEN_KEY,         session.accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken);

      // Busca o perfil completo agora que a sessão está em aal2
      const { data } = await api.get<{ usuario: User }>('/users/me');

      set({
        user:            data.usuario,
        accessToken:     session.accessToken,
        isAuthenticated: true,
        mfaPending:      false,
        mfaFactorId:     null,
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
      const { data } = await api.post<{
        mensagem?: string;
        sessao?:   { accessToken: string; refreshToken: string };
        usuario?:  User;
      }>('/auth/register', { username, email, password });

      // Erros (409 e-mail/username já cadastrado, 400...) fazem o axios lançar
      // antes daqui. Sem sessão = conta criada, aguardando confirmação do e-mail
      if (!data.sessao || !data.usuario) {
        set({ isLoading: false });
        return 'confirm_email';
      }

      await SecureStore.setItemAsync(TOKEN_KEY,         data.sessao.accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.sessao.refreshToken);

      set({
        user:            data.usuario,
        accessToken:     data.sessao.accessToken,
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
      if (get().accessToken) {
        await api.post('/auth/logout');
      }
    } catch {
      // Mesmo em erro, limpa localmente
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    set({
      user: null, accessToken: null, isAuthenticated: false, isLoading: false,
      mfaPending: false, mfaFactorId: null,
    });
  },

  loadSession: async () => {
    set({ isLoading: true });
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) { set({ isLoading: false }); return; }

      // Verifica se o token ainda é válido buscando o perfil
      const { data } = await api.get<{ usuario: User }>('/users/me');

      // Sessão restaurada em aal1 com um fator TOTP verificado pendente de
      // step-up (ex: app fechado no meio da verificação de 2FA do login) —
      // não pode reabrir já autenticada, senão o 2FA fica sem efeito.
      if (decodeJwtAal(token) === 'aal1') {
        const factors = await getMfaFactors().catch(() => []);
        const pendingFactor = factors.find((f) => f.status === MFAFactorStatus.Verified);
        if (pendingFactor) {
          set({
            accessToken:     token,
            mfaPending:      true,
            mfaFactorId:     pendingFactor.id,
            isAuthenticated: false,
            isLoading:       false,
          });
          return;
        }
      }

      set({
        user:            data.usuario,
        accessToken:     token,
        isAuthenticated: true,
        isLoading:       false,
      });
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
