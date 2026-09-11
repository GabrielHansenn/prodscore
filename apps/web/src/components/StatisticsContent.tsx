import type { ReactNode } from 'react';
import type { UserStats } from '../store/userStore.js';
import LevelProgress from './LevelProgress.js';
import {
  BoltIcon,
  FlameIcon,
  CheckCircleIcon,
  TrophyIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  ClipboardIcon,
} from './icons.js';

/** Subconjunto de UserStats que a tela de estatísticas exibe — atendido tanto por /me/stats quanto por /users/:id/stats */
export type StatisticsData = Pick<
  UserStats,
  | 'level' | 'totalPoints' | 'pointsThisWeek' | 'tasksCompletedThisWeek' | 'consistencyRate'
  | 'currentStreak' | 'longestStreak' | 'tasksCompleted' | 'tasksTotal' | 'achievementsCount'
>;

function StatCard({
  icon, iconBg, label, value, color, sub,
}: {
  icon:   ReactNode;
  iconBg: string;
  label:  string;
  value:  string | number;
  color:  string;
  sub?:   string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${iconBg}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          <p className="truncate text-xs text-gray-500">{label}</p>
          {sub && <p className="truncate text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * Corpo da tela de estatísticas (nível, semana, sequências, geral).
 * Usado pela página do próprio usuário (StatisticsPage) e pelo perfil de um
 * amigo (FriendProfilePage) — o que muda é só de onde vêm os dados.
 */
export default function StatisticsContent({ stats }: { stats: StatisticsData }) {
  const completePct = stats.tasksTotal > 0
    ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100)
    : 0;

  return (
    <div className="space-y-8">

      {/* Nível e progresso */}
      <div className="card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <BoltIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Nível {stats.level}</p>
            <p className="text-xs text-gray-500">{stats.totalPoints.toLocaleString('pt-BR')} pontos totais</p>
          </div>
        </div>
        <LevelProgress level={stats.level} totalPoints={stats.totalPoints} />
      </div>

      {/* Esta semana */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <CalendarIcon className="h-3.5 w-3.5" />
          Esta Semana
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<BoltIcon className="h-5 w-5" />}
            iconBg="bg-brand-600"
            label="Pontos Ganhos"
            value={stats.pointsThisWeek.toLocaleString('pt-BR')}
            color="text-brand-600"
          />
          <StatCard
            icon={<CheckCircleIcon className="h-5 w-5" />}
            iconBg="bg-green-600"
            label="Tarefas Concluídas"
            value={stats.tasksCompletedThisWeek}
            color="text-green-600"
          />
          <StatCard
            icon={<ArrowTrendingUpIcon className="h-5 w-5" />}
            iconBg="bg-blue-600"
            label="Consistência"
            value={`${Math.round(stats.consistencyRate)}%`}
            color="text-blue-600"
            sub="dos dias ativos"
          />
        </div>
      </section>

      {/* Sequências */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <FlameIcon className="h-3.5 w-3.5" />
          Sequências
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                <FlameIcon className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{stats.currentStreak}</p>
                <p className="text-xs text-gray-500">Sequência atual (dias)</p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20">
                <FlameIcon className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-500">{stats.longestStreak}</p>
                <p className="text-xs text-gray-500">Maior sequência (dias)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Geral */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <TrophyIcon className="h-3.5 w-3.5" />
          Geral
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<CheckCircleIcon className="h-5 w-5" />}
            iconBg="bg-green-600"
            label="Tarefas Concluídas"
            value={stats.tasksCompleted}
            color="text-green-600"
          />
          <StatCard
            icon={<ClipboardIcon className="h-5 w-5" />}
            iconBg="bg-gray-600"
            label="Taxa de Conclusão"
            value={`${completePct}%`}
            color="text-gray-700"
            sub={`${stats.tasksCompleted} de ${stats.tasksTotal} tarefas`}
          />
          <StatCard
            icon={<TrophyIcon className="h-5 w-5" />}
            iconBg="bg-amber-500"
            label="Conquistas"
            value={stats.achievementsCount}
            color="text-amber-500"
          />
          <StatCard
            icon={<BoltIcon className="h-5 w-5" />}
            iconBg="bg-brand-600"
            label="Total de Pontos"
            value={stats.totalPoints.toLocaleString('pt-BR')}
            color="text-brand-600"
          />
        </div>
      </section>

    </div>
  );
}
