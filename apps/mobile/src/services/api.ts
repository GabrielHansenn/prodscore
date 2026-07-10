import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

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

// Interceptor de resposta: 401 → limpa token (store trata o redirecionamento)
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
    return Promise.reject(error);
  },
);
