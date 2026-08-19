import { api } from './api';

/**
 * Altera a senha do usuário autenticado.
 * Rota protegida por AAL2 — requer 2FA verificado na sessão atual.
 */
export async function changePassword(newPassword: string): Promise<void> {
  await api.patch('/auth/password', { newPassword });
}

/**
 * Exclui permanentemente a conta do usuário autenticado.
 * Rota protegida por AAL2 — requer 2FA verificado na sessão atual.
 */
export async function deleteAccount(): Promise<void> {
  await api.delete('/users/me');
}
