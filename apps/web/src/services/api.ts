import axios from 'axios';
import { getAccessToken } from '../lib/supabase.js';
import { getFriendlyErrorMessage } from '../lib/errors.js';

/**
 * Instância Axios centralizada para todas as chamadas ao backend Express.
 * Base URL configurável via VITE_API_URL; fallback para o proxy local do Vite.
 */
export const api = axios.create({
  baseURL: (import.meta.env['VITE_API_URL'] as string | undefined) ?? '/api',
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Interceptor de request: injeta o Bearer token da sessão Supabase em toda requisição.
 * O token é obtido do localStorage via supabase.auth.getSession(), que renova
 * automaticamente se estiver expirado.
 */
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

/**
 * Interceptor de response: em caso de 401, limpa o estado local e redireciona para /login.
 * Usa window.location.replace para forçar reload e limpar qualquer estado em memória.
 */
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Importação dinâmica evita dependência circular entre api.ts ↔ authStore.ts
      void import('../store/authStore.js').then(({ useAuthStore }) => {
        useAuthStore.getState().clearSession();
      });
      window.location.replace('/login');
    }
    return Promise.reject(error);
  },
);

/**
 * Executa uma chamada à API e, se falhar, relança um `Error` com mensagem
 * amigável em português (ver `getFriendlyErrorMessage`) — assim qualquer
 * componente que capturar o erro e usar `err.message` já mostra algo legível,
 * sem precisar tratar cada chamada individualmente.
 *
 * @param fn       - Função que executa a chamada à API e retorna o resultado
 * @param fallback - Mensagem específica da ação, usada quando a API não
 *                   retornar um `erro` amigável (ex: falha de rede, 500)
 */
export async function callApi<T>(fn: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new Error(getFriendlyErrorMessage(err, fallback));
  }
}
