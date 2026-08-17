import type { ConsentState } from '@prodscore/shared';
import { api } from './api.js';

/**
 * Registra o consentimento de cookies na API, para prestação de contas (LGPD).
 *
 * Best-effort: disparado em segundo plano ao salvar a escolha. Uma falha de
 * rede aqui não deve bloquear a navegação — o consentimento já está salvo
 * localmente (localStorage) independente do resultado desta chamada.
 */
export async function recordConsent(consent: ConsentState, version: string): Promise<void> {
  try {
    await api.post('/consent', { consent, version });
  } catch {
    // Silencioso de propósito — ver docstring acima
  }
}
