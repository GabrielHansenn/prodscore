import { api, extractApiErrorMessage } from './api.js';

/**
 * Altera a senha do usuário autenticado.
 * Rota protegida por AAL2 — requer 2FA verificado na sessão atual.
 */
export async function changePassword(newPassword: string): Promise<void> {
  try {
    await api.patch('/auth/password', { newPassword });
  } catch (err) {
    throw new Error(extractApiErrorMessage(err, 'Erro ao alterar a senha.'));
  }
}

/**
 * Exclui permanentemente a conta do usuário autenticado.
 * Rota protegida por AAL2 — requer 2FA verificado na sessão atual.
 */
export async function deleteAccount(): Promise<void> {
  try {
    await api.delete('/users/me');
  } catch (err) {
    throw new Error(extractApiErrorMessage(err, 'Erro ao excluir a conta.'));
  }
}
