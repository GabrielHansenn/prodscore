import { CookieCategory, type ConsentState } from '../types/index.js';

/**
 * Versão da política de consentimento de cookies.
 * Incremente ao mudar categorias, finalidades ou a própria política — isso
 * faz o banner reaparecer para usuários que já haviam consentido numa versão anterior.
 */
export const CONSENT_VERSION = '1.0.0';

/**
 * Todas as categorias de cookie, na ordem em que devem ser exibidas na UI.
 * `Essential` vem primeiro por ser a única sempre ativa/obrigatória.
 */
export const ALL_COOKIE_CATEGORIES: ReadonlyArray<CookieCategory> = [
  CookieCategory.Essential,
  CookieCategory.Analytics,
  CookieCategory.Functional,
  CookieCategory.Marketing,
];

/**
 * Estado padrão antes de qualquer escolha do usuário.
 * Apenas `essential` vem ativo — as demais exigem consentimento explícito
 * (opt-in), nunca consentimento presumido.
 */
export const DEFAULT_CONSENT_STATE: ConsentState = {
  [CookieCategory.Essential]: true,
  [CookieCategory.Analytics]: false,
  [CookieCategory.Functional]: false,
  [CookieCategory.Marketing]: false,
};

/** Estado de "aceitar todos" — todas as categorias ativas */
export const ACCEPT_ALL_CONSENT_STATE: ConsentState = {
  [CookieCategory.Essential]: true,
  [CookieCategory.Analytics]: true,
  [CookieCategory.Functional]: true,
  [CookieCategory.Marketing]: true,
};
