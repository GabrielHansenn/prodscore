/**
 * Regras da navegação do celular (barra inferior, abaixo de 1024px).
 *
 * Barra: Início · Tarefas · (+ nova tarefa) · Grupos · Menu.
 * O Menu abre uma folha com o resto das telas — por isso as rotas dele
 * deixam a aba "Menu" destacada.
 */

export type MobileTab = 'inicio' | 'tarefas' | 'grupos' | 'menu';

/** Telas que ficam dentro do Menu (folha que abre de baixo para cima) */
export const MENU_ROUTES = [
  '/ranking', '/perfil', '/amigos', '/conquistas', '/estatisticas', '/configuracoes/seguranca', '/ajuda',
] as const;

const startsWithRoute = (pathname: string, route: string) =>
  pathname === route || pathname.startsWith(`${route}/`);

/** Aba destacada para a rota atual (null = nenhuma, ex: página 404) */
export function activeMobileTab(pathname: string): MobileTab | null {
  if (startsWithRoute(pathname, '/dashboard')) return 'inicio';
  if (startsWithRoute(pathname, '/tarefas'))   return 'tarefas';
  if (startsWithRoute(pathname, '/grupos'))    return 'grupos';
  if (MENU_ROUTES.some((route) => startsWithRoute(pathname, route))) return 'menu';
  return null;
}

/**
 * Telas que precisam da altura toda e escondem a barra: o chat com um amigo
 * (tem botão de voltar próprio e o campo de digitar fica no rodapé).
 */
export function hidesBottomNav(pathname: string): boolean {
  return /^\/amigos\/[^/]+\/chat\/?$/.test(pathname);
}

/**
 * Espaço que a barra ocupa no rodapé (pílula + margem + área segura do iPhone).
 * Vira a variável CSS --bottom-nav-height, usada pelo <main>, toasts e banner
 * de cookies para não ficarem atrás da barra.
 */
export const BOTTOM_NAV_SPACE = 'calc(5.25rem + env(safe-area-inset-bottom, 0px))';
