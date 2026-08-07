import axios from 'axios';
import * as SecureStore from '../lib/storage';

/** Chave usada para guardar o access token no SecureStore */
export const TOKEN_KEY = 'prodscore_access_token';

/**
 * Instância central do cliente HTTP.
 * A URL base é lida da variável de ambiente EXPO_PUBLIC_API_URL.
 * Em desenvolvimento local, aponta para o backend Express na rede local.
 */
export const api = axios.create({
  baseURL: process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000',
  timeout: 10_000,
});

// Interceptor de requisição: injeta o Bearer token se existir
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de resposta:
// - 401 → limpa token (store trata o redirecionamento)
// - reescreve error.message com o campo `erro` retornado pela API
//   (formato { erro, codigo? } — ver packages/api/src/lib/errors.ts),
//   já que por padrão o axios só expõe "Request failed with status code XXX".
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
      const serverMessage = (error.response?.data as { erro?: string } | undefined)?.erro;
      if (serverMessage) {
        error.message = serverMessage;
      }
    }
    return Promise.reject(error);
  },
);
