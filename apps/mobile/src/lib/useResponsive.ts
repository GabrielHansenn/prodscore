import { useWindowDimensions } from 'react-native';

/** Ponto de corte "tela larga" — a partir daqui mostramos sidebar em vez de tab bar */
export const WIDE_BREAKPOINT = 900;

/** Largura máxima do conteúdo em telas largas (espelha max-w-7xl do web) */
export const CONTENT_MAX_WIDTH = 1120;

/** Largura da sidebar em telas largas (espelha w-60 do Sidebar.tsx web) */
export const SIDEBAR_WIDTH = 240;

/** Detecta se a tela atual é "larga" (desktop/tablet) — mesmo código roda em web e nativo */
export function useResponsive() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  return { width, isWide };
}
