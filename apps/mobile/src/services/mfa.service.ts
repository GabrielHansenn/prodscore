import type { MFAFactor } from '@prodscore/shared';
import { api, REFRESH_TOKEN_KEY } from './api';
import * as SecureStore from '../lib/storage';

/**
 * Serviço de autenticação de dois fatores (2FA/TOTP) do mobile.
 *
 * Diferente da web (que fala direto com supabase.auth.mfa.* no navegador),
 * o mobile nunca fala com o Supabase diretamente — essas chamadas passam
 * pelo backend (rotas /auth/mfa/*), que precisa também do refresh token
 * (não só do access token do cabeçalho Authorization) pra reidratar a
 * sessão do usuário e operar supabase.auth.mfa.* do lado do servidor.
 */

export interface TOTPEnrollment {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
  otpauthUri: string;
}

export interface MFASession {
  accessToken: string;
  refreshToken: string;
}

async function getRefreshToken(): Promise<string> {
  const token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');
  return token;
}

/** Lista os fatores TOTP do usuário autenticado — verificados e não verificados */
export async function getMfaFactors(): Promise<MFAFactor[]> {
  const refreshToken = await getRefreshToken();
  const { data } = await api.get<{ fatores: MFAFactor[] }>('/auth/mfa/factors', {
    params: { refreshToken },
  });
  return data.fatores;
}

/** Inicia o cadastro de um novo fator TOTP para o usuário autenticado */
export async function enrollMfa(): Promise<TOTPEnrollment> {
  const refreshToken = await getRefreshToken();
  const { data } = await api.post<TOTPEnrollment>('/auth/mfa/enroll', { refreshToken });
  return data;
}

/**
 * Confirma um código TOTP de 6 dígitos — usado tanto para confirmar um novo
 * enrollment quanto para o step-up de login (aal1 → aal2).
 */
export async function verifyMfaCode(factorId: string, code: string): Promise<MFASession> {
  const refreshToken = await getRefreshToken();
  const { data } = await api.post<{ sessao: MFASession }>('/auth/mfa/verify', {
    factorId, code, refreshToken,
  });
  return data.sessao;
}

/** Remove um fator TOTP cadastrado, desativando o 2FA associado a ele */
export async function unenrollMfa(factorId: string): Promise<void> {
  const refreshToken = await getRefreshToken();
  await api.delete(`/auth/mfa/${factorId}`, { data: { refreshToken } });
}

/** Traduz as mensagens de erro mais comuns do Supabase MFA para português */
export function translateMFAErrorMessage(rawMessage: string): string {
  const msg = rawMessage.toLowerCase();

  if (msg.includes('invalid') && (msg.includes('totp') || msg.includes('code')))
    return 'Código inválido. Verifique o aplicativo autenticador e tente novamente.';
  if (msg.includes('expired'))
    return 'Código expirado. Gere um novo código no aplicativo autenticador e tente novamente.';
  if (msg.includes('already enrolled') || msg.includes('already exists'))
    return 'Você já possui um fator de autenticação ativo.';
  if (msg.includes('too many requests') || msg.includes('rate limit'))
    return 'Muitas tentativas. Aguarde alguns instantes e tente novamente.';

  return 'Não foi possível confirmar o código. Tente novamente.';
}
