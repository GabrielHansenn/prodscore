import { useEffect, useState } from 'react';
import {
  getAchievements,
  getUserAchievements,
  type AchievementItem,
  type UserAchievementItem,
} from '../services/achievement.service.js';
import { useUserStore } from '../store/userStore.js';
import AchievementCard from '../components/AchievementCard.js';
import { TrophyIcon, LockClosedIcon } from '../components/icons.js';

type Filter = 'todas' | 'conquistadas' | 'bloqueadas';

export default function AchievementsPage() {
  const { stats, fetchStats } = useUserStore();

  const [catalog, setCatalog] = useState<AchievementItem[]>([]);
  const [earned,  setEarned]  = useState<UserAchievementItem[]>([]);
  const [filter,  setFilter]  = useState<Filter>('todas');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchStats();
    void (async () => {
      try {
        const [all, mine] = await Promise.all([getAchievements(), getUserAchievements()]);
        setCatalog(all);
        setEarned(mine);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const earnedMap  = new Map(earned.map((e) => [e.id, e]));
  const filtered   = catalog.filter((a) => {
    if (filter === 'conquistadas') return earnedMap.has(a.id);
    if (filter === 'bloqueadas')   return !earnedMap.has(a.id);
    return true;
  });
  const earnedCount = earned.length;
  const pct         = catalog.length > 0 ? Math.round((earnedCount / catalog.length) * 100) : 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Conquistas</h1>
        <p className="mt-0.5 text-sm text-gray-500">Complete objetivos e desbloqueie recompensas especiais</p>
      </div>

      {/* Banner de progresso */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {earnedCount} de {catalog.length} conquistas desbloqueadas
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{pct}% concluído</p>
          </div>
          <TrophyIcon className="h-8 w-8 text-amber-500" />
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-900/40">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        {stats?.achievementsCount !== undefined && stats.achievementsCount !== earnedCount && (
          <p className="mt-2 text-xs text-gray-400">
            (baseado em dados do servidor: {stats.achievementsCount} conquistas)
          </p>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
        {([
          { key: 'todas',        label: 'Todas',        count: catalog.length           },
          { key: 'conquistadas', label: 'Conquistadas', count: earnedCount              },
          { key: 'bloqueadas',   label: 'Bloqueadas',   count: catalog.length - earnedCount },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              filter === f.key ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 ${filter === f.key ? 'text-brand-200' : 'text-gray-400'}`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Galeria */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <LockClosedIcon className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 font-medium text-gray-600">
            {filter === 'conquistadas' ? 'Nenhuma conquista desbloqueada ainda' : 'Nenhum resultado'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => {
            const userAch = earnedMap.get(a.id);
            return (
              <AchievementCard
                key={a.id}
                achievement={a}
                earned={!!userAch}
                {...(userAch?.earnedAt ? { earnedAt: userAch.earnedAt } : {})}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
