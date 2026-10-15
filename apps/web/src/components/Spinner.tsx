const SIZES = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
} as const;

/**
 * Indicador de carregamento padrão. Antes cada tela desenhava o seu, em
 * quatro tamanhos, sem nada para o leitor de tela anunciar.
 */
export default function Spinner({ size = 'md', label = 'Carregando' }: { size?: keyof typeof SIZES; label?: string }) {
  return (
    <span role="status" className="inline-flex">
      <span
        aria-hidden="true"
        className={`${SIZES[size]} animate-spin rounded-full border-2 border-gray-200 border-t-brand-600 dark:border-gray-700 dark:border-t-brand-400`}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
