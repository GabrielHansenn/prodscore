import { useEffect } from 'react';
import { useUserStore } from '../store/userStore.js';
import StatisticsContent from '../components/StatisticsContent.js';

export default function StatisticsPage() {
  const { stats, fetchStats } = useUserStore();

  useEffect(() => {
    void fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Estatísticas</h1>
        <p className="mt-1 text-sm text-gray-500">Visão geral do seu desempenho</p>
      </div>

      {!stats ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
        </div>
      ) : (
        <StatisticsContent stats={stats} />
      )}
    </main>
  );
}
