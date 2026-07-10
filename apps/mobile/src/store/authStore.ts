import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@prodscore/shared';
import { api, TOKEN_KEY } from '../services/api';

const REFRESH_KEY = 'prodscore_refresh_token';

interface AuthState {
  user:            User | null;
  accessToken:     string | null;
  isLoading:       boolean;
  isAuthenticated: boolean;

  /** Autentica com e-mail e senha via POST /auth/login */
  login:       (email: string, password: string) => Promise<void>;
  /** Registra novo usuário via POST /auth/register */
  register:    (username: string, email: string, password: string) => Promise<void>;
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

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post<{
        sessao:  { accessToken: string; refreshToken: string };
        usuario: User;
      }>('/auth/login', { email, password });

      await SecureStore.setItemAsync(TOKEN_KEY,   data.sessao.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, data.sessao.refreshToken);

      set({
        user:            data.usuario,
        accessToken:     data.sessao.accessToken,
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
      const { data } = await api.post<{
        mensagem?: string;
        sessao?:   { accessToken: string; refreshToken: string };
        usuario?:  User;
      }>('/auth/register', { username, email, password });

      // Se confirmação de e-mail estiver habilitada, não há sessão
      if (!data.sessao || !data.usuario) {
        set({ isLoading: false });
        throw new Error('CONFIRM_EMAIL');
      }

      await SecureStore.setItemAsync(TOKEN_KEY,   data.sessao.accessToken);
      await SecureStore.setItemAsync(REFRESH_KEY, data.sessao.refreshToken);

      set({
        user:            data.usuario,
        accessToken:     data.sessao.accessToken,
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
      if (get().accessToken) {
        await api.post('/auth/logout');
      }
    } catch {
      // Mesmo em erro, limpa localmente
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  },

  loadSession: async () => {
    set({ isLoading: true });
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) { set({ isLoading: false }); return; }

      // Verifica se o token ainda é válido buscando o perfil
      const { data } = await api.get<{ usuario: User }>('/users/me');

      set({
        user:            data.usuario,
        accessToken:     token,
        isAuthenticated: true,
        isLoading:       false,
      });
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
