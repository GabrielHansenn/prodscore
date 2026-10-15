import { useState } from 'react';
import { ExclamationTriangleIcon } from './icons.js';

interface ErrorStateProps {
  /** O que não carregou, já em linguagem do usuário */
  message: string;
  /** Tenta carregar de novo; o botão mostra "Tentando…" enquanto a Promise não termina */
  onRetry?: () => unknown;
  /** Versão compacta, para dentro de cards e abas */
  compact?: boolean;
}

/**
 * Estado de erro padrão das telas: diz o que não carregou e oferece
 * "Tentar novamente". Antes, falhas de carregamento apareciam como lista
 * vazia ("Nenhuma tarefa encontrada") ou carregamento infinito.
 */
export default function ErrorState({ message, onRetry, compact = false }: ErrorStateProps) {
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try { await onRetry(); } finally { setRetrying(false); }
  };

  return (
    <div
      role="alert"
      className={`flex flex-col items-center text-center ${
        compact
          ? 'py-8'
          : 'rounded-xl border border-red-200 bg-red-50 px-6 py-10 dark:border-red-800/50 dark:bg-red-900/20'
      }`}
    >
      <ExclamationTriangleIcon className="h-8 w-8 text-red-500 dark:text-red-400" />
      <p className="mt-3 max-w-sm text-sm font-medium text-red-700 dark:text-red-300">{message}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Verifique sua conexão e tente de novo.</p>
      {onRetry && (
        <button type="button" onClick={() => void retry()} disabled={retrying} className="btn-secondary mt-4 text-sm">
          {retrying ? 'Tentando…' : 'Tentar novamente'}
        </button>
      )}
    </div>
  );
}
