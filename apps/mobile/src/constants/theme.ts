/**
 * Paleta de cores do ProdScore Mobile — tema claro e escuro.
 * Espelha a marca roxa do app web (apps/web/tailwind.config.ts) e os mesmos
 * tokens semânticos de superfície/texto de apps/web/src/index.css (:root e
 * .dark), incluindo o roxo escuro usado na sidebar do desktop — aqui
 * reaproveitado na tab bar inferior. A sidebar/nav é sempre escura nos dois
 * temas (mesma decisão do Sidebar.tsx do web), por isso os tokens `nav*`
 * abaixo não variam entre `lightColors`/`darkColors`.
 */
export const lightColors = {
  // Fundos
  background: '#f9fafb',
  card:       '#ffffff',
  border:     '#e5e7eb',
  borderSoft: '#f3f4f6',
  input:      '#ffffff',
  inputBorder:'#d1d5db',

  // Marca — roxo
  primary50:  '#f5f3ff',
  primary100: '#ede9fe',
  primary400: '#a78bfa',
  primary500: '#8b5cf6',
  primary:    '#7c3aed',
  primaryDark:'#6d28d9',
  primaryDim: 'rgba(124,58,237,0.10)',

  // Sidebar/nav roxo-escuro (espelha apps/web Sidebar.tsx) — igual nos dois temas
  navBg:     '#1a0b2e',
  navHover:  '#2d1654',
  navActive: '#3b1f6b',
  navBorder: '#2a1250',
  navText:   '#c4b5fd',
  navMuted:  '#7c5cbf',

  // Verde-esmeralda — sucesso/pontos/dificuldade fácil (TaskCard.tsx no web)
  success:    '#059669',
  successDim: 'rgba(16,185,129,0.10)',

  // Acento lime — só usado no card "Nível" do dashboard e detalhes pontuais
  lime:      '#a3e635',
  limeText:  '#65a30d',
  limeDim:   'rgba(163,230,53,0.14)',

  // Semânticas de dificuldade/status
  amber:     '#f59e0b',
  amberDim:  'rgba(245,158,11,0.12)',
  amberText: '#b45309',
  orange:    '#f97316',
  orangeDim: 'rgba(249,115,22,0.12)',
  red:    '#ef4444',
  redDim: 'rgba(239,68,68,0.10)',
  blue:    '#3b82f6',
  blueDim: 'rgba(59,130,246,0.12)',

  // Texto
  text:          '#111827',
  textSecondary: '#6b7280',
  textMuted:     '#9ca3af',
  textOnDark:    '#f9fafb',
};

/**
 * Tema escuro — superfícies/texto/borda usam os mesmos hex de
 * apps/web/src/index.css (bloco `.dark`); as cores semânticas (sucesso,
 * aviso, perigo) usam o tom "-400" do Tailwind, igual ao que o web usa em
 * `dark:` (ex: `--danger: 248 113 113` = red-400). Marca roxa e nav mantidos
 * fixos, como no web.
 */
export const darkColors: typeof lightColors = {
  // Fundos
  background: '#0c0b18',
  card:       '#1c1b32',
  border:     '#312f5e',
  borderSoft: '#222040',
  input:      '#222040',
  inputBorder:'#3e3b6e',

  // Marca — roxo (mesma âncora do tema claro)
  primary50:  'rgba(124,58,237,0.10)',
  primary100: '#2d1f52',
  primary400: '#a78bfa',
  primary500: '#8b5cf6',
  primary:    '#7c3aed',
  primaryDark:'#6d28d9',
  primaryDim: 'rgba(124,58,237,0.18)',

  // Sidebar/nav — igual ao tema claro (sempre escura nos dois temas)
  navBg:     '#1a0b2e',
  navHover:  '#2d1654',
  navActive: '#3b1f6b',
  navBorder: '#2a1250',
  navText:   '#c4b5fd',
  navMuted:  '#7c5cbf',

  // Verde-esmeralda
  success:    '#34d399',
  successDim: 'rgba(16,185,129,0.18)',

  // Acento lime
  lime:      '#a3e635',
  limeText:  '#bef264',
  limeDim:   'rgba(163,230,53,0.20)',

  // Semânticas de dificuldade/status
  amber:     '#fbbf24',
  amberDim:  'rgba(245,158,11,0.18)',
  amberText: '#fcd34d',
  orange:    '#fb923c',
  orangeDim: 'rgba(249,115,22,0.18)',
  red:    '#f87171',
  redDim: 'rgba(239,68,68,0.18)',
  blue:    '#60a5fa',
  blueDim: 'rgba(59,130,246,0.18)',

  // Texto
  text:          '#eeeef8',
  textSecondary: '#b8b8d8',
  textMuted:     '#8f8fb8',
  textOnDark:    '#f9fafb',
};

export type ColorPalette = typeof lightColors;

/** Gradientes para os stat cards — versões claras das cores de marca */
export const GRADIENTS = {
  primary: ['rgba(124,58,237,0.10)', 'rgba(124,58,237,0.02)'] as const,
  amber:   ['rgba(245,158,11,0.10)', 'rgba(245,158,11,0.02)'] as const,
  lime:    ['rgba(132,204,22,0.10)', 'rgba(132,204,22,0.02)'] as const,
  blue:    ['rgba(59,130,246,0.10)', 'rgba(59,130,246,0.02)'] as const,
};

/** Gradiente roxo → lime da barra de XP (bg-gradient-to-r from-brand-600 to-lime-400) */
export const LEVEL_BAR_GRADIENT = ['#7c3aed', '#a3e635'] as const;

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
} as const;

export const RADIUS = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
} as const;

export const FONT = {
  sm:   12,
  base: 14,
  md:   16,
  lg:   18,
  xl:   22,
  xxl:  28,
} as const;

/** Família tipográfica — mesma fonte (Montserrat) do app web */
export const FONT_FAMILY = {
  regular:   'Montserrat_400Regular',
  medium:    'Montserrat_500Medium',
  semibold:  'Montserrat_600SemiBold',
  bold:      'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
} as const;

/** Sombra padrão dos cards (equivalente ao shadow-card do Tailwind) */
export const CARD_SHADOW = {
  shadowColor:   '#000',
  shadowOffset:  { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius:  3,
  elevation:     2,
} as const;
