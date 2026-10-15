import { api } from './api';

/**
 * Altera a senha do usuário autenticado. Exige a senha atual de todos e, de
 * quem tem 2FA ativo, a sessão verificada com o código (requireSensitiveAuth).
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.patch('/auth/password', { currentPassword, newPassword });
}

/**
 * Exclui permanentemente a conta do usuário autenticado. Mesma confirmação
 * da troca de senha.
 */
export async function deleteAccount(currentPassword: string): Promise<void> {
  await api.delete('/users/me', { data: { currentPassword } });
}
