import { useEffect } from 'react';
import { useUserStore } from '../store/userStore.js';
import StatisticsContent from '../components/StatisticsContent.js';
import ErrorState from '../components/ErrorState.js';
import Spinner from '../components/Spinner.js';

export default function StatisticsPage() {
  const { stats, loadError, fetchStats } = useUserStore();

  useEffect(() => {
    void fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Estatísticas</h1>
        <p className="mt-1 text-sm text-gray-500">Visão geral do seu desempenho</p>
      </div>

      {!stats && loadError ? (
        // Antes ficava carregando para sempre quando a API falhava
        <ErrorState message={loadError} onRetry={fetchStats} />
      ) : !stats ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : (
        <StatisticsContent stats={stats} />
      )}
    </div>
  );
}
