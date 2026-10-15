/**
 * Regras de validação de campo compartilhadas entre web e mobile.
 * Cada validador retorna a mensagem de erro em português (pronta pra exibir)
 * ou `null` quando o valor é válido — evita que as duas plataformas divirjam
 * silenciosamente (ex: uma exigir senha de 8 caracteres e a outra de 6).
 */

/**
 * Formato do e-mail:
 * - parte local: letras, números e . _ % + - (sem começar/terminar com ponto
 *   nem ter ".." — verificado à parte em validateEmail)
 * - domínio: rótulos de letras/números/hífen separados por ponto
 * - terminação (TLD): só letras, 2 a 24 — "gmail.c0m" ou "gmail.c" não passam
 */
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

const INVALID_EMAIL_MESSAGE = 'Informe um e-mail válido (ex: nome@dominio.com).';

/**
 * Erros de digitação comuns na terminação do e-mail → terminação correta.
 * Nenhuma dessas existe como terminação de verdade, então o e-mail certamente
 * está errado (ex: "nome@gmail.comm"). A regex sozinha aceitaria, porque
 * qualquer sequência de letras tem formato de terminação.
 */
const TLD_TYPOS: Record<string, string> = {
  comm: 'com', con: 'com', cmo: 'com', ocm: 'com', vom: 'com', xom: 'com',
  coom: 'com', comn: 'com', cpm: 'com', cim: 'com', clm: 'com', cok: 'com',
  nett: 'net', ner: 'net', nte: 'net',
  orgg: 'org', ogr: 'org',
  brr: 'br', rb: 'br',
};

/**
 * Provedores grandes que só existem nesses domínios. "gmail.co" tem formato
 * válido (.co é a terminação da Colômbia), mas não existe e-mail do Gmail
 * nela — então é erro de digitação, sem risco de recusar um e-mail real.
 */
const PROVIDER_DOMAINS: Record<string, string[]> = {
  gmail:   ['gmail.com'],
  hotmail: ['hotmail.com', 'hotmail.com.br'],
  outlook: ['outlook.com', 'outlook.com.br'],
  yahoo:   ['yahoo.com', 'yahoo.com.br'],
  icloud:  ['icloud.com'],
};

/** Mensagem de formato inválido sugerindo o e-mail corrigido */
function invalidWithSuggestion(local: string, domain: string): string {
  return `E-mail em formato inválido. Você quis dizer ${local}@${domain}?`;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const PASSWORD_HAS_LETTER = /[a-zA-Z]/;
const PASSWORD_HAS_NUMBER = /[0-9]/;

export function validateRequired(value: string, fieldLabel: string): string | null {
  return value.trim() ? null : `${fieldLabel} é obrigatório.`;
}

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'E-mail é obrigatório.';
  if (!EMAIL_REGEX.test(value)) return INVALID_EMAIL_MESSAGE;

  const [local = '', domain = ''] = value.toLowerCase().split('@');
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return INVALID_EMAIL_MESSAGE;

  const labels = domain.split('.');
  const tld    = labels[labels.length - 1]!;

  // Terminação digitada errada: ".comm", ".con", ".brr"...
  const fixedTld = TLD_TYPOS[tld];
  if (fixedTld) {
    return invalidWithSuggestion(local, [...labels.slice(0, -1), fixedTld].join('.'));
  }

  // Provedor conhecido com terminação que ele não usa: "gmail.co", "hotmail.cm"...
  const providerDomains = PROVIDER_DOMAINS[labels[0]!];
  if (providerDomains && !providerDomains.includes(domain)) {
    return invalidWithSuggestion(local, providerDomains[0]!);
  }

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

// ---------------------------------------------------------------------------
// Erros de cadastro ligados a um campo do formulário
// ---------------------------------------------------------------------------

/** Códigos (`codigo`) que POST /auth/register devolve com status 409 */
export const REGISTER_ERROR_CODES = {
  emailTaken:    'EMAIL_JA_CADASTRADO',
  usernameTaken: 'USERNAME_JA_EM_USO',
} as const;

/**
 * Campo do formulário de cadastro ao qual cada erro de conflito pertence —
 * web e mobile exibem a mensagem embaixo desse campo, não num aviso genérico.
 */
export const REGISTER_ERROR_FIELDS: Record<string, 'email' | 'username'> = {
  [REGISTER_ERROR_CODES.emailTaken]:    'email',
  [REGISTER_ERROR_CODES.usernameTaken]: 'username',
};
