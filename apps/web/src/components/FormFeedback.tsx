/**
 * Bloco de feedback de formulário (erro ou sucesso) — visual único reusado
 * em todo o app, no lugar de cada tela reimplementar seu próprio `<p>`.
 */
export default function FormFeedback({ variant, message }: { variant: 'error' | 'success'; message: string }) {
  const isError = variant === 'error';
  return (
    <p
      role={isError ? 'alert' : 'status'}
      className={`rounded-xl border px-3 py-2.5 text-xs ${
        isError
          ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300'
          : 'border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-800/60 dark:bg-lime-900/20 dark:text-lime-400'
      }`}
    >
      {message}
    </p>
  );
}

/** Erro de um campo específico, exibido logo abaixo do input. */
export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
      {msg}
    </p>
  );
}
