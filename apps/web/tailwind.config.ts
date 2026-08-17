import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ---------------------------------------------------------------
        // Tokens semânticos — valores reais em src/index.css via CSS vars,
        // trocam automaticamente entre os temas claro/escuro (ver :root/.dark).
        // Uso: bg-surface, bg-surface-elevated, text-ink, border-border etc.
        // ---------------------------------------------------------------
        surface: {
          DEFAULT:  'rgb(var(--surface) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
          sunken:   'rgb(var(--surface-sunken) / <alpha-value>)',
          hover:    'rgb(var(--surface-hover) / <alpha-value>)',
        },
        ink: {
          DEFAULT:   'rgb(var(--ink) / <alpha-value>)',
          secondary: 'rgb(var(--ink-secondary) / <alpha-value>)',
          muted:     'rgb(var(--ink-muted) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          strong:  'rgb(var(--border-strong) / <alpha-value>)',
        },
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        danger:  'rgb(var(--danger) / <alpha-value>)',
        // Roxo primário — cor de marca do ProdScore
        brand: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Sidebar escuro
        sidebar: {
          bg:     '#1a0b2e',
          hover:  '#2d1654',
          active: '#3b1f6b',
          border: '#2a1250',
          text:   '#c4b5fd',
          muted:  '#7c5cbf',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)',
        'brand': '0 4px 14px rgba(124,58,237,0.35)',
      },
      keyframes: {
        'slide-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'in': 'slide-in-up 200ms ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
