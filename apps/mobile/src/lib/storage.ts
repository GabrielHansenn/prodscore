import * as SecureStore from 'expo-secure-store';

/**
 * Armazenamento seguro de tokens — nativo (iOS/Android) usa o Keychain/Keystore
 * via expo-secure-store. No web, o Metro resolve `storage.web.ts` no lugar
 * deste arquivo automaticamente (convenção de extensão de plataforma).
 */
export async function getItemAsync(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
