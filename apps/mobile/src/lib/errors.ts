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
