/// <reference lib="dom" />
/**
 * Armazenamento seguro de tokens — versão web.
 * O navegador não tem Keychain/Keystore; usa localStorage como equivalente
 * (mesma abordagem do apps/web, que também guarda a sessão no localStorage
 * via o client do Supabase).
 */
export async function getItemAsync(key: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}
