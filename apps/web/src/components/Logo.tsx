// ---------------------------------------------------------------------------
// LogoMark — ícone isolado (checkmark + seta), sem fundo
// Use dentro de containers coloridos (bg-brand-600, etc.)
// ---------------------------------------------------------------------------
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 27 L20 35 L33 21"
        stroke="white"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27 16 L36 16 L36 25"
        stroke="#A3E635"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// LogoWordmark — logo completa (ícone + texto "ProdScore")
// variant="light" → fundo do tema (ícone gradiente, "Score" roxo; "Prod"
//                   escuro no tema claro e branco no tema escuro — antes era
//                   sempre escuro e sumia sobre o fundo escuro)
// variant="dark"  → fundo sempre escuro, ex: menu lateral e painel do login
//                   (ícone lilás, "Prod" branco, "Score" lima)
// ---------------------------------------------------------------------------
interface LogoWordmarkProps {
  variant?: 'light' | 'dark';
  className?: string;
}

export function LogoWordmark({ variant = 'light', className }: LogoWordmarkProps) {
  const isDark   = variant === 'dark';
  const prodFill  = isDark ? '#FFFFFF'  : '#17153A';
  const scoreFill = isDark ? '#A3E635'  : '#7C3AED';
  const checkStroke = isDark ? '#A5B4FC' : 'url(#lw-grad)';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 56"
      className={className}
      role="img"
      aria-label="ProdScore"
    >
      {!isDark && (
        <defs>
          <linearGradient id="lw-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#4338CA" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      )}
      <g transform="translate(2,4)">
        <path
          d="M7 27 L19 39 L37 19"
          fill="none"
          stroke={checkStroke}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M29 14 L41 14 L41 26"
          fill="none"
          stroke="#A3E635"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <text
        x="58"
        y="41"
        fontFamily="Outfit, 'Segoe UI', sans-serif"
        fontWeight="800"
        fontSize="36"
        letterSpacing="-0.7"
      >
        {/* Na variante light, a cor de "Prod" vem da classe (acompanha o tema escuro) */}
        <tspan fill={prodFill} className={isDark ? undefined : 'fill-[#17153A] dark:fill-white'}>Prod</tspan>
        <tspan fill={scoreFill}>Score</tspan>
      </text>
    </svg>
  );
}
