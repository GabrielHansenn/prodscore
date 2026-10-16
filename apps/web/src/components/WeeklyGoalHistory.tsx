import { useEffect, useState } from 'react';
import { explainWeeklyGoal, utcWeekStartKey, type WeeklyGoalProgress } from '@prodscore/shared';
import { getWeeklyGoalHistory } from '../services/adaptive.service.js';
import { FlagIcon } from './icons.js';
import Spinner from './Spinner.js';

/** "16/06 – 22/06" a partir da segunda-feira AAAA-MM-DD (UTC) */
function weekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end   = new Date(start.getTime() + 6 * 86_400_000);
  const fmt   = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Histórico das últimas metas semanais (tela de Estatísticas) */
export default function WeeklyGoalHistory() {
  const [goals,   setGoals]   = useState<WeeklyGoalProgress[] | null>(null);
  const [failed,  setFailed]  = useState(false);

  useEffect(() => {
    getWeeklyGoalHistory(8)
      .then(setGoals)
      .catch(() => setFailed(true));
  }, []);

  const currentWeek = utcWeekStartKey();

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        <FlagIcon className="h-4 w-4" />
        Metas semanais
      </h2>

      {failed ? (
        <p className="card p-5 text-sm text-gray-500">Não foi possível carregar o histórico de metas.</p>
      ) : !goals ? (
        <div className="card flex justify-center p-6"><Spinner size="md" /></div>
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-800">
          {goals.map((goal) => {
            const isCurrent = goal.weekStart === currentWeek;
            const achieved  = goal.achievedAt !== null;
            const status = achieved
              ? { text: 'Batida',       cls: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' }
              : isCurrent
                ? { text: 'Em andamento', cls: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' }
                : { text: 'Não batida',   cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };

            return (
              <div key={goal.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {isCurrent ? 'Esta semana' : weekLabel(goal.weekStart)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{explainWeeklyGoal(goal)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-gray-900">{goal.completed}/{goal.target}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>
                    {status.text}
                  </span>
                  {achieved && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">+{goal.rewardPoints} pts</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
