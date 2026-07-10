import { useEffect, useState } from 'react';
import { TaskStatus, MissionType, type LevelReward, type PointTransaction, type Mission, type ProcrastinationAlert } from '@prodscore/shared';
import { useAuthStore } from '../store/authStore.js';
import { useTaskStore } from '../store/taskStore.js';
import { useUserStore } from '../store/userStore.js';
import { supabase } from '../lib/supabase.js';
import TaskCard from '../components/TaskCard.js';
import LevelProgress from '../components/LevelProgress.js';
import StreakBadge from '../components/StreakBadge.js';
import MissionCard from '../components/MissionCard.js';
import PointTransactionFeed from '../components/PointTransactionFeed.js';
import { SparklesIcon, FlameIcon, ExclamationTriangleIcon } from '../components/icons.js';
import { getProcrastinationAlerts } from '../services/behavioral.service.js';

interface Toast {
  id:      number;
  message: string;
  type:    'success' | 'milestone';
}

interface Celebration {
  days: number;
}

const LEVEL_BADGE_EMOJI: Record<string, string> = {
  rocket:  '🚀',
  star:    '⭐',
  diamond: '💎',
  crown:   '👑',
  legend:  '🏆',
};

function StatCard({
  label, value, sub, accent, glow,
}: {
  label:  string;
  value:  string | number;
  sub?:   string;
  accent: string;
  glow?:  string;
}) {
  return (
    <div className={`card p-5 transition-all hover:shadow-card-hover ${glow ?? ''}`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const user        = useAuthStore((s) => s.user);
  const { tasks, fetchTasks, completeTask } = useTaskStore((s) => ({
    tasks:        s.tasks,
    fetchTasks:   s.fetchTasks,
    completeTask: s.completeTask,
  }));
  const { stats, fetchStats } = useUserStore((s) => ({
    stats:      s.stats,
    fetchStats: s.fetchStats,
  }));

  const [transactions,   setTransactions]   = useState<PointTransaction[]>([]);
  const [toasts,         setToasts]         = useState<Toast[]>([]);
  const [celebration,    setCelebration]    = useState<Celebration | null>(null);
  const [levelRewardPop, setLevelRewardPop] = useState<LevelReward | null>(null);
  const [completing,     setCompleting]     = useState<Set<string>>(new Set());
  const [alerts,         setAlerts]         = useState<ProcrastinationAlert[]>([]);
  const [alertsDismissed, setAlertsDismissed] = useState(false);

  useEffect(() => {
    void fetchTasks();
    void fetchStats();

    if (user) {
      void supabase
        .from('point_transactions')
        .select('id, user_id, amount, reason, reference_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => {
          if (data) {
            setTransactions(
              data.map((row) => ({
                id:          row.id as string,
                userId:      row.user_id as string,
                amount:      row.amount as number,
                reason:      row.reason as PointTransaction['reason'],
                referenceId: (row.reference_id as string | null) ?? null,
                createdAt:   row.created_at as string,
              })),
            );
          }
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void getProcrastinationAlerts().then(setAlerts).catch(() => { /* opcional */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const todayTasks = tasks.filter((t) => {
    if (t.status === TaskStatus.Completed) return false;
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due >= todayStart && due <= todayEnd;
  });

  const handleComplete = async (taskId: string) => {
    setCompleting((prev) => new Set(prev).add(taskId));
    try {
      const result = await completeTask(taskId);
      const toastId = Date.now();
      setToasts((prev) => [...prev, { id: toastId, message: `Tarefa concluída! +${result.pontosGanhos} pts`, type: 'success' }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toastId)), 4000);
      if (result.marcoStreak    !== null) setCelebration({ days: result.marcoStreak });
      if (result.recompensaNivel)         setLevelRewardPop(result.recompensaNivel);
      void fetchStats();
      if (user) {
        setTransactions((prev) => [
          { id: `local-${toastId}`, userId: user.id, amount: result.pontosGanhos, reason: 'task_completed' as PointTransaction['reason'], referenceId: taskId, createdAt: new Date().toISOString() },
          ...prev.slice(0, 4),
        ]);
      }
    } catch { /* erro tratado pelo store */ } finally {
      setCompleting((prev) => { const n = new Set(prev); n.delete(taskId); return n; });
    }
  };

  const firstName   = user?.username.split('_')[0] ?? 'Usuário';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const activeMissions = (stats?.activeMissions ?? []).slice(0, 3);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">

      {/* Saudação */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {displayName}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </p>
      </div>

      {/* 4 cards de estatísticas */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total de Pontos"
          value={(user?.totalPoints ?? 0).toLocaleString('pt-BR')}
          sub={`#${stats?.rankPosition ?? '–'} no ranking`}
          accent="text-brand-500"
          glow="stat-card-glow-purple"
        />
        <StatCard
          label="Sequência Atual"
          value={user?.currentStreak ?? 0}
          sub={`${(user?.currentStreak ?? 0) === 1 ? 'dia consecutivo' : 'dias consecutivos'}`}
          accent="text-amber-500"
          glow="stat-card-glow-amber"
        />
        <StatCard
          label="Nível"
          value={user?.level ?? 1}
          sub={`${stats?.achievementsCount ?? 0} conquistas`}
          accent="text-lime-400"
          glow="stat-card-glow-lime"
        />
        <StatCard
          label="Tarefas Esta Semana"
          value={stats?.tasksCompletedThisWeek ?? 0}
          sub={`${stats?.pointsThisWeek ?? 0} pts esta semana`}
          accent="text-blue-400"
          glow="stat-card-glow-blue"
        />
      </div>

      {/* Barra de XP */}
      {user && (
        <div className="card mb-6 p-5">
          <LevelProgress level={user.level} totalPoints={user.totalPoints} />
        </div>
      )}

      {/* Alertas de procrastinação — Mecânica 10 */}
      {alerts.length > 0 && !alertsDismissed && (
        <div className="mb-6 space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                alert.severity === 'critical'
                  ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                  : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
              }`}
            >
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{alert.message}</p>
                {alert.taskTitles.length > 0 && (
                  <p className="mt-0.5 truncate text-xs opacity-75">
                    {alert.taskTitles.slice(0, 3).join(' · ')}
                    {alert.taskTitles.length > 3 ? ` +${alert.taskTitles.length - 3}` : ''}
                  </p>
                )}
              </div>
              {i === 0 && (
                <button
                  onClick={() => setAlertsDismissed(true)}
                  className="shrink-0 text-xs opacity-60 hover:opacity-100"
                  aria-label="Fechar alertas"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tarefas do dia + sidebar direita */}
      <div className="mb-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Tarefas de Hoje</h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {todayTasks.length}
              </span>
            </div>

            {todayTasks.length === 0 ? (
              <div className="py-8 text-center">
                <SparklesIcon className="mx-auto h-10 w-10 text-brand-300" />
                <p className="mt-2 text-sm text-gray-500">Nenhuma tarefa para hoje!</p>
                <p className="mt-1 text-xs text-gray-400">Que tal criar uma nova?</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayTasks.map((task) => (
                  <div key={task.id} className={completing.has(task.id) ? 'opacity-60' : ''}>
                    <TaskCard
                      task={task}
                      onComplete={(id) => void handleComplete(id)}
                      onDelete={() => void 0}
                      compact
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {user && (
            <StreakBadge
              currentStreak={user.currentStreak}
              longestStreak={user.longestStreak}
              streakFreezes={user.streakFreezes}
            />
          )}

          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Últimas transações</h3>
            <PointTransactionFeed transactions={transactions} />
          </div>
        </div>
      </div>

      {/* Missões ativas */}
      {activeMissions.length > 0 && (
        <div>
          <h2 className="mb-4 font-semibold text-gray-900">Missões Ativas</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeMissions.map((m) => {
              const missionData: Mission = {
                id:           m.id,
                title:        m.title,
                description:  '',
                type:         m.type === 'group' ? MissionType.Group : MissionType.Individual,
                groupId:      null,
                targetValue:  m.targetValue,
                currentValue: m.currentValue,
                rewardPoints: m.rewardPoints,
                expiresAt:    m.expiresAt,
                isCompleted:  false,
                createdAt:    '',
              };
              return <MissionCard key={m.id} mission={missionData} isParticipating />;
            })}
          </div>
        </div>
      )}

      {/* P8: aria-live="polite" — screen readers anunciam sem interromper */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-3 shadow-card-hover animate-in"
          >
            <svg className="h-4 w-4 shrink-0 text-lime-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="text-sm font-medium text-gray-800">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Modal de recompensa de nível */}
      {levelRewardPop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-brand-200 bg-white p-8 text-center shadow-2xl">
            <div className="mb-2 text-5xl">
              {LEVEL_BADGE_EMOJI[levelRewardPop.badgeKey ?? ''] ?? '🎁'}
            </div>
            <h2 className="text-2xl font-bold text-brand-600">
              Nível {levelRewardPop.level} atingido!
            </h2>
            <p className="mt-2 text-gray-600">{levelRewardPop.description}</p>
            <div className="mt-4 flex justify-center gap-4 text-sm font-semibold">
              {levelRewardPop.bonusPoints > 0 && (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-600">
                  +{levelRewardPop.bonusPoints} pts
                </span>
              )}
              {levelRewardPop.bonusFreezes > 0 && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-600">
                  +{levelRewardPop.bonusFreezes} 🧊 freeze{levelRewardPop.bonusFreezes > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              onClick={() => setLevelRewardPop(null)}
              className="btn-primary mt-6 w-full"
            >
              Incrível!
            </button>
          </div>
        </div>
      )}

      {/* Modal de streak */}
      {celebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-2xl">
            <div className="mb-4 flex justify-center">
              <FlameIcon className="h-14 w-14 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold text-amber-600">
              Sequência de {celebration.days} dias!
            </h2>
            <p className="mt-2 text-gray-600">Incrível! Você está em chamas. Continue assim!</p>
            <p className="mt-1 text-sm font-semibold text-lime-600">+50 pontos bônus!</p>
            <button
              onClick={() => setCelebration(null)}
              className="btn-primary mt-6 w-full"
            >
              Continue produtivo!
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
