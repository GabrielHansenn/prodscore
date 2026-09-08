import { api, callApi } from './api.js';

/**
 * Altera a senha do usuário autenticado.
 * Rota protegida por AAL2 — requer 2FA verificado na sessão atual.
 */
export async function changePassword(newPassword: string): Promise<void> {
  await callApi(
    () => api.patch('/auth/password', { newPassword }),
    'Erro ao alterar a senha.',
  );
}

/**
 * Exclui permanentemente a conta do usuário autenticado.
 * Rota protegida por AAL2 — requer 2FA verificado na sessão atual.
 */
export async function deleteAccount(): Promise<void> {
  await callApi(
    () => api.delete('/users/me'),
    'Erro ao excluir a conta.',
  );
}
