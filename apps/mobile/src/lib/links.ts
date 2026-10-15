import { Linking } from 'react-native';
import { showToast } from '../store/toastStore';

/**
 * Endereço do site do ProdScore (EXPO_PUBLIC_WEB_URL no apps/mobile/.env),
 * usado para abrir páginas que só existem no web, como a Política de
 * Privacidade. Sem a variável, os links para o site não aparecem.
 */
export const WEB_URL = (process.env['EXPO_PUBLIC_WEB_URL'] ?? '').replace(/\/+$/, '');

export const PRIVACY_POLICY_URL = WEB_URL ? `${WEB_URL}/politica-de-privacidade` : null;

/** Abre uma página do site no navegador do aparelho */
export async function openWebPage(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    showToast('Não foi possível abrir o navegador.', 'error');
  }
}

/** Abre a Política de Privacidade do site (sem efeito se EXPO_PUBLIC_WEB_URL não estiver definida) */
export function openPrivacyPolicy(): void {
  if (PRIVACY_POLICY_URL) void openWebPage(PRIVACY_POLICY_URL);
}
