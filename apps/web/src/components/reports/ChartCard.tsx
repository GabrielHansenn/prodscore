import type { ReactNode } from 'react';
import Spinner from '../Spinner.js';
import ErrorState from '../ErrorState.js';

interface ChartCardProps {
  title:     string;
  subtitle?: string;
  loading:   boolean;
  error:     string | null;
  onRetry:   () => void;
  /** Sem dados no período — mostra a mensagem em vez do gráfico */
  empty:     boolean;
  emptyText?: string;
  /** Altura da área do gráfico (padrão 224px) — ex: cresce com o número de membros */
  height?:   number;
  children:  ReactNode;
}

/** Moldura dos gráficos com os estados de carregamento, erro e vazio */
export default function ChartCard({
  title, subtitle, loading, error, onRetry, empty, emptyText = 'Nenhum dado neste período.', height = 224, children,
}: ChartCardProps) {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <p className="font-semibold text-gray-900">{title}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div style={{ height }}>
        {loading ? (
          <div className="flex h-full items-center justify-center"><Spinner size="md" /></div>
        ) : error ? (
          <div className="flex h-full items-center justify-center"><ErrorState compact message={error} onRetry={onRetry} /></div>
        ) : empty ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500 dark:border-gray-700">
            {emptyText}
          </div>
        ) : children}
      </div>
    </div>
  );
}
