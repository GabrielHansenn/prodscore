import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TaskStatus, MissionType, type LevelReward, type PointTransaction, type Mission, type ProcrastinationAlert } from '@prodscore/shared';
import { useAuthStore } from '../store/authStore.js';
import { useTaskStore } from '../store/taskStore.js';
import { useUserStore } from '../store/userStore.js';
import { showToast } from '../store/toastStore.js';
import { refreshStatsAndShowXpGain } from '../lib/xpGain.js';
import { supabase } from '../lib/supabase.js';
import TaskCard from '../components/TaskCard.js';
import LevelProgress from '../components/LevelProgress.js';
import StreakBadge from '../components/StreakBadge.js';
import MissionCard from '../components/MissionCard.js';
import PointTransactionFeed from '../components/PointTransactionFeed.js';
import WeeklyGoalCard from '../components/WeeklyGoalCard.js';
import Modal from '../components/Modal.js';
import { getDismissedAlertTypes, dismissAlertType } from '../lib/dismissedAlerts.js';
import ErrorState from '../components/ErrorState.js';
import { SparklesIcon, FlameIcon, ExclamationTriangleIcon, SnowflakeIcon } from '../components/icons.js';
import { getProcrastinationAlerts } from '../services/behavioral.service.js';

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
  label, value, sub, accent, glow, loading = false,
}: {
  label:  string;
  value:  string | number;
  sub?:   string;
  accent: string;
  glow?:  string;
  /** Enquanto os dados não chegam: esqueleto no lugar de números zerados */
  loading?: boolean;
}) {
  return (
    <div className={`card p-5 transition-all hover:shadow-card-hover ${glow ?? ''}`} aria-busy={loading}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      {loading ? (
        <>
          <span className="mt-2 block h-8 w-20 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          <span className="mt-2 block h-3 w-24 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
          <span className="sr-only">Carregando</span>
        </>
      ) : (
        <>
          <p className={`mt-1 text-3xl font-bold ${accent}`}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const user        = useAuthStore((s) => s.user);
  const { tasks, tasksError, fetchTasks, completeTask } = useTaskStore((s) => ({
    tasks:        s.tasks,
    tasksError:   s.loadError,
    fetchTasks:   s.fetchTasks,
    completeTask: s.completeTask,
  }));
  const { stats, statsError, fetchStats } = useUserStore((s) => ({
    stats:      s.stats,
    statsError: s.loadError,
    fetchStats: s.fetchStats,
  }));

  const [transactions,   setTransactions]   = useState<PointTransaction[]>([]);
  const [celebration,    setCelebration]    = useState<Celebration | null>(null);
  const [levelRewardPop, setLevelRewardPop] = useState<LevelReward | null>(null);
  const [completing,     setCompleting]     = useState<Set<string>>(new Set());
  const [alerts,         setAlerts]         = useState<ProcrastinationAlert[]>([]);
  // Tipos de alerta fechados hoje (lembrados até o fim do dia)
  const [dismissedAlerts, setDismissedAlerts] = useState(getDismissedAlertTypes);

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

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.type));

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
      void refreshStatsAndShowXpGain(result);
      if (result.marcoStreak    !== null) setCelebration({ days: result.marcoStreak });
      if (result.recompensaNivel)         setLevelRewardPop(result.recompensaNivel);
      if (user) {
        setTransactions((prev) => [
          { id: `local-${Date.now()}`, userId: user.id, amount: result.pontosGanhos, reason: 'task_completed' as PointTransaction['reason'], referenceId: taskId, createdAt: new Date().toISOString() },
          ...prev.slice(0, 4),
        ]);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao concluir a tarefa.', 'error');
    } finally {
      setCompleting((prev) => { const n = new Set(prev); n.delete(taskId); return n; });
    }
  };

  const firstName   = user?.username.split('_')[0] ?? 'Usuário';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  const activeMissions = (stats?.activeMissions ?? []).slice(0, 3);

  return (
    <div>

      {/* Saudação */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Olá, {displayName}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </p>
      </div>

      {/* Resumo não carregou: diz isso em vez de deixar os cards carregando para sempre */}
      {!stats && statsError && (
        <div className="mb-6">
          <ErrorState message={statsError} onRetry={fetchStats} />
        </div>
      )}

      {/* 4 cards de estatísticas */}
      {!(statsError && !stats) && (
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total de Pontos"
          loading={!stats}
          value={(stats?.totalPoints ?? 0).toLocaleString('pt-BR')}
          sub={`#${stats && stats.rankPosition > 0 ? stats.rankPosition : '–'} no ranking`}
          accent="text-brand-500"
          glow="stat-card-glow-purple"
        />
        <StatCard
          label="Sequência Atual"
          loading={!stats}
          value={stats?.currentStreak ?? 0}
          sub={`${(stats?.currentStreak ?? 0) === 1 ? 'dia consecutivo' : 'dias consecutivos'}`}
          accent="text-amber-500"
          glow="stat-card-glow-amber"
        />
        <StatCard
          label="Nível"
          loading={!stats}
          value={stats?.level ?? 1}
          sub={`${stats?.achievementsCount ?? 0} conquistas`}
          accent="text-lime-700 dark:text-lime-400"
          glow="stat-card-glow-lime"
        />
        <StatCard
          label="Tarefas Esta Semana"
          loading={!stats}
          value={stats?.tasksCompletedThisWeek ?? 0}
          sub={`${stats?.pointsThisWeek ?? 0} pts esta semana`}
          accent="text-blue-600 dark:text-blue-400"
          glow="stat-card-glow-blue"
        />
      </div>
      )}

      {/* Barra de XP */}
      {stats && (
        <div className="card mb-6 p-5">
          <LevelProgress level={stats.level} totalPoints={stats.totalPoints} />
        </div>
      )}

      {/* Meta da semana — gamificação adaptativa (recarrega quando os pontos mudam) */}
      <WeeklyGoalCard {...(stats ? { refreshKey: stats.totalPoints } : {})} />

      {/* Alertas de procrastinação — Mecânica 10 */}
      {visibleAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {visibleAlerts.map((alert) => (
            <div
              key={alert.type}
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
              {/* Um botão por alerta, com área de toque de 44px (antes: "✕" minúsculo só
                  no primeiro alerta, que fechava todos e voltava ao recarregar) */}
              <button
                type="button"
                onClick={() => setDismissedAlerts(dismissAlertType(alert.type))}
                className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg opacity-70 transition-opacity hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                aria-label="Fechar este alerta até amanhã"
                title="Fechar até amanhã"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tarefas do dia + sidebar direita */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Tarefas de Hoje</h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {todayTasks.length}
              </span>
            </div>

            {tasksError && tasks.length === 0 ? (
              <ErrorState compact message={tasksError} onRetry={fetchTasks} />
            ) : todayTasks.length === 0 ? (
              <div className="py-8 text-center">
                <SparklesIcon className="mx-auto h-10 w-10 text-brand-300" />
                <p className="mt-2 text-sm text-gray-500">Nenhuma tarefa com prazo para hoje.</p>
                <p className="mt-1 text-xs text-gray-400">Tarefas sem prazo ficam na página Tarefas.</p>
                <Link to="/tarefas?nova=1" className="btn-secondary mt-4 text-sm">
                  + Nova tarefa
                </Link>
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
          {stats && (
            <StreakBadge
              currentStreak={stats.currentStreak}
              longestStreak={stats.longestStreak}
              streakFreezes={stats.streakFreezes}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Modal de recompensa de nível */}
      {levelRewardPop && (
        <Modal
          onClose={() => setLevelRewardPop(null)}
          labelledBy="level-reward-title"
          className="w-full max-w-sm rounded-2xl border border-brand-200 bg-white p-8 text-center shadow-2xl dark:border-brand-800/60"
        >
            <div className="mb-2 text-5xl" aria-hidden="true">
              {LEVEL_BADGE_EMOJI[levelRewardPop.badgeKey ?? ''] ?? '🎁'}
            </div>
            <h2 id="level-reward-title" className="text-2xl font-bold text-brand-600 dark:text-brand-400">
              Nível {levelRewardPop.level} atingido!
            </h2>
            <p className="mt-2 text-gray-600">{levelRewardPop.description}</p>
            <div className="mt-4 flex justify-center gap-4 text-sm font-semibold">
              {levelRewardPop.bonusPoints > 0 && (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                  +{levelRewardPop.bonusPoints} pts
                </span>
              )}
              {levelRewardPop.bonusFreezes > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                  <SnowflakeIcon className="h-3.5 w-3.5" />
                  +{levelRewardPop.bonusFreezes} freeze{levelRewardPop.bonusFreezes > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              onClick={() => setLevelRewardPop(null)}
              className="btn-primary mt-6 w-full"
            >
              Incrível!
            </button>
        </Modal>
      )}

      {/* Modal de streak */}
      {celebration && (
        <Modal
          onClose={() => setCelebration(null)}
          labelledBy="streak-celebration-title"
          className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-2xl dark:border-amber-800/60"
        >
            <div className="mb-4 flex justify-center">
              <FlameIcon className="h-14 w-14 text-amber-500" />
            </div>
            <h2 id="streak-celebration-title" className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              Sequência de {celebration.days} dias!
            </h2>
            <p className="mt-2 text-gray-600">Incrível! Você está em chamas. Continue assim!</p>
            <p className="mt-1 text-sm font-semibold text-lime-700 dark:text-lime-400">+50 pontos bônus!</p>
            <button
              onClick={() => setCelebration(null)}
              className="btn-primary mt-6 w-full"
            >
              Continue produtivo!
            </button>
        </Modal>
      )}
    </div>
  );
}
