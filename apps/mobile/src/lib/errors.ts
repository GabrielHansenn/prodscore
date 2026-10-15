import axios from 'axios';

/**
 * Extrai uma mensagem de erro amigável em português a partir de qualquer erro
 * capturado num catch. No mobile, o interceptor de resposta em services/api.ts
 * já reescreve `error.message` com a mensagem amigável (campo `erro` da API,
 * aviso de rede, ou fallback genérico) — esta função só formaliza o contrato
 * pra todas as telas usarem o mesmo padrão em vez de `err.message` cru.
 *
 * @param err      - Erro capturado no catch
 * @param fallback - Mensagem a usar quando o erro não tem `.message` utilizável
 */
export function getFriendlyErrorMessage(err: unknown, fallback = 'Algo deu errado. Tente novamente em instantes.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * Código de erro (`codigo`) devolvido pela API Express, ex: 'EMAIL_JA_CADASTRADO'.
 * Serve para a tela reagir a um erro específico (ex: marcar o campo de e-mail)
 * sem depender do texto da mensagem.
 *
 * @returns o código, ou `null` se o erro não veio da API ou não tem código
 */
export function getApiErrorCode(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const body = err.response?.data as { codigo?: unknown } | undefined;
  return typeof body?.codigo === 'string' ? body.codigo : null;
}
