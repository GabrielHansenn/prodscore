import axios from 'axios';
import { api } from './api.js';

/** Extrai a mensagem de erro em português enviada pela API, com fallback genérico */
function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { erro?: string } | undefined;
    if (body?.erro) return body.erro;
  }
  return err instanceof Error ? err.message : fallback;
}

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
