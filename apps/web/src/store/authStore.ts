import { create } from 'zustand';
import type { User } from '@prodscore/shared';
import { signIn, signUp, signOut, getSession } from '../lib/supabase.js';
import { api } from '../services/api.js';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Session {
  accessToken: string;
  refreshToken: string;
}

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

  /** Autentica com e-mail e senha; lança erro em caso de falha */
  login: (email: string, password: string) => Promise<void>;
  /** Registra novo usuário; lança 'CONFIRM_EMAIL' se precisar confirmar e-mail */
  register: (username: string, email: string, password: string) => Promise<void>;
  /** Encerra a sessão e limpa o estado */
  logout: () => Promise<void>;
  /** Restaura sessão existente do localStorage na montagem da aplicação */
  loadSession: () => Promise<void>;
  /** Limpa o estado sem chamar a API (usado pelo interceptor de 401) */
  clearSession: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set) => ({
  user:            null,
  session:         null,
  isInitializing:  true,   // começa true para evitar flash de tela de login
  isLoading:       false,
  isAuthenticated: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data: supabaseSession, error } = await signIn(email, password);

      if (error || !supabaseSession) {
        throw new Error(error ?? 'E-mail ou senha incorretos.');
      }

      // Busca o perfil completo com dados de gamificação
      const { data } = await api.get<{ usuario: User }>('/users/me');

      set({
        user:            data.usuario,
        session:         {
          accessToken:  supabaseSession.access_token,
          refreshToken: supabaseSession.refresh_token,
        },
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
      const { data: supabaseSession, error } = await signUp(email, password, username);

      if (error) {
        throw new Error(error);
      }

      if (!supabaseSession) {
        // Confirmação de e-mail obrigatória — código especial para a UI tratar
        set({ isLoading: false });
        throw new Error('CONFIRM_EMAIL');
      }

      // Auto-confirmação ativa: busca o perfil criado pelo trigger
      const { data } = await api.get<{ usuario: User }>('/users/me');

      set({
        user:            data.usuario,
        session:         {
          accessToken:  supabaseSession.access_token,
          refreshToken: supabaseSession.refresh_token,
        },
        isAuthenticated: true,
        isLoading:       false,
      });
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
    set({ user: null, session: null, isAuthenticated: false, isLoading: false });
  },

  loadSession: async () => {
    try {
      const session = await getSession();

      if (!session) {
        set({ isInitializing: false });
        return;
      }

      // Sessão válida — busca perfil atualizado da API
      const { data } = await api.get<{ usuario: User }>('/users/me');

      set({
        user:            data.usuario,
        session:         {
          accessToken:  session.access_token,
          refreshToken: session.refresh_token,
        },
        isAuthenticated: true,
        isInitializing:  false,
      });
    } catch {
      // Sessão expirada ou perfil não encontrado
      set({ user: null, session: null, isAuthenticated: false, isInitializing: false });
    }
  },

  clearSession: () => {
    set({ user: null, session: null, isAuthenticated: false, isLoading: false });
  },
}));
