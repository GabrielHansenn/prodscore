import axios from 'axios';

/**
 * Mensagens amigáveis de erro em um único lugar — nenhuma tela deve exibir
 * `err.message` cru (nem do axios, nem do Supabase Auth) diretamente ao usuário.
 */

export const GENERIC_ERROR_MESSAGE = 'Algo deu errado. Tente novamente em instantes.';
export const NETWORK_ERROR_MESSAGE = 'Não foi possível conectar. Verifique sua internet.';

/**
 * Traduz mensagens conhecidas do Supabase Auth (login, cadastro) para PT-BR.
 * Usado para erros que NÃO passam pela API Express (login/registro batem
 * direto no Supabase), então não vêm no formato `{ erro }` do backend.
 * Retorna `null` quando a mensagem não é reconhecida — quem chamar decide o fallback.
 */
function translateSupabaseAuthError(raw: string): string | null {
  const msg = raw.toLowerCase();

  if (msg.includes('invalid login credentials'))
    return 'E-mail ou senha incorretos.';
  if (msg.includes('email not confirmed'))
    return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('user already registered') || msg.includes('already registered') || msg.includes('already been registered'))
    return 'Este e-mail já possui uma conta. Tente fazer login.';
  if (msg.includes('invalid email') || msg.includes('unable to validate email'))
    return 'Endereço de e-mail inválido.';
  if (msg.includes('password should be at least') || msg.includes('password is too short'))
    return 'A senha deve ter no mínimo 8 caracteres.';
  if (msg.includes('rate limit') || msg.includes('too many requests'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (msg.includes('signup is disabled') || msg.includes('signups not allowed'))
    return 'Cadastros estão temporariamente desativados. Tente mais tarde.';
  if (msg.includes('network') || msg.includes('failed to fetch'))
    return NETWORK_ERROR_MESSAGE;

  return null;
}

/**
 * Extrai uma mensagem de erro amigável em português a partir de qualquer erro
 * capturado num catch — seja da API Express (axios, formato `{ erro, codigo? }`)
 * ou do Supabase Auth (login/registro, `Error` com mensagem em inglês).
 *
 * @param err      - Erro capturado no catch
 * @param fallback - Mensagem a usar quando nada mais se aplica (específica do formulário)
 */
export function getFriendlyErrorMessage(err: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return NETWORK_ERROR_MESSAGE;

    const body = err.response.data as { erro?: string } | undefined;
    if (body?.erro) return body.erro;

    if (err.response.status >= 500) return GENERIC_ERROR_MESSAGE;

    return fallback;
  }

  if (err instanceof Error) {
    return translateSupabaseAuthError(err.message) ?? fallback;
  }

  return fallback;
}
