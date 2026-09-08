/**
 * Regras de validação de campo compartilhadas entre web e mobile.
 * Cada validador retorna a mensagem de erro em português (pronta pra exibir)
 * ou `null` quando o valor é válido — evita que as duas plataformas divirjam
 * silenciosamente (ex: uma exigir senha de 8 caracteres e a outra de 6).
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const PASSWORD_HAS_LETTER = /[a-zA-Z]/;
const PASSWORD_HAS_NUMBER = /[0-9]/;

export function validateRequired(value: string, fieldLabel: string): string | null {
  return value.trim() ? null : `${fieldLabel} é obrigatório.`;
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'E-mail é obrigatório.';
  if (!EMAIL_REGEX.test(email.trim())) return 'Informe um e-mail válido (ex: nome@dominio.com).';
  return null;
}

export function validateUsername(username: string): string | null {
  if (!username.trim()) return 'Nome de usuário é obrigatório.';
  if (!USERNAME_REGEX.test(username.trim())) return 'Use 3–30 caracteres: letras, números ou _.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Senha é obrigatória.';
  if (password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!PASSWORD_HAS_LETTER.test(password)) return 'A senha precisa conter pelo menos uma letra.';
  if (!PASSWORD_HAS_NUMBER.test(password)) return 'A senha precisa conter pelo menos um número.';
  return null;
}

export function validatePasswordConfirmation(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) return 'Confirme sua senha.';
  if (confirmPassword !== password) return 'As senhas não coincidem.';
  return null;
}

export function validateInviteCode(code: string): string | null {
  if (!code.trim()) return 'Código de convite é obrigatório.';
  if (code.trim().length < 4) return 'Código de convite inválido.';
  return null;
}

/** Valida um número positivo (ex: meta ou recompensa de uma missão) vindo de um input de texto */
export function validatePositiveNumber(value: string, fieldLabel: string): string | null {
  if (!value.trim()) return `${fieldLabel} é obrigatório.`;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return `${fieldLabel} precisa ser um número maior que zero.`;
  return null;
}
