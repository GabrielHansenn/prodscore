/** Paleta de cores do tema escuro do ProdScore Mobile */
export const COLORS = {
  // Fundos
  background: '#030712',
  card:       '#111827',
  border:     '#1f2937',
  input:      '#1f2937',

  // Destaques de gamificação
  emerald:    '#34d399',
  emeraldDim: 'rgba(52,211,153,0.12)',
  amber:      '#fbbf24',
  amberDim:   'rgba(251,191,36,0.12)',
  violet:     '#a78bfa',
  violetDim:  'rgba(167,139,250,0.12)',
  blue:       '#60a5fa',
  red:        '#f87171',
  redDim:     'rgba(248,113,113,0.12)',

  // Texto
  text:          '#f9fafb',
  textSecondary: '#9ca3af',
  textMuted:     '#4b5563',
};

/** Gradientes para os stat cards */
export const GRADIENTS = {
  emerald: ['rgba(52,211,153,0.15)', 'rgba(52,211,153,0.04)'] as const,
  amber:   ['rgba(251,191,36,0.15)',  'rgba(251,191,36,0.04)'] as const,
  violet:  ['rgba(167,139,250,0.15)', 'rgba(167,139,250,0.04)'] as const,
  blue:    ['rgba(96,165,250,0.15)',  'rgba(96,165,250,0.04)'] as const,
};

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
