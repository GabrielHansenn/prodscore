import { useEffect, useState } from 'react';
import { explainWeeklyGoal, type WeeklyGoalProgress } from '@prodscore/shared';
import { getWeeklyGoal } from '../services/adaptive.service.js';
import { FlagIcon, CheckCircleIcon } from './icons.js';

interface WeeklyGoalCardProps {
  /**
   * Muda quando os pontos do usuário mudam (ex: total de pontos) — recarrega
   * o progresso depois de concluir uma tarefa sem a tela precisar avisar.
   */
  refreshKey?: number;
}

/**
 * Card "Meta da semana" — gamificação adaptativa. Mostra o progresso, o bônus
 * em jogo e por que a meta é essa (calculada a partir do histórico do usuário).
 */
export default function WeeklyGoalCard({ refreshKey }: WeeklyGoalCardProps) {
  const [goal, setGoal] = useState<WeeklyGoalProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWeeklyGoal()
      .then((g) => { if (!cancelled) setGoal(g); })
      // Card complementar: se falhar, simplesmente não aparece
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (!goal) return null;

  const achieved   = goal.achievedAt !== null;
  const percentage = Math.min((goal.completed / goal.target) * 100, 100);
  const remaining  = Math.max(0, goal.target - goal.completed);

  return (
    <div className="card mb-6 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${achieved ? 'bg-lime-600' : 'bg-brand-600'}`}>
            {achieved ? <CheckCircleIcon className="h-5 w-5" /> : <FlagIcon className="h-5 w-5" />}
          </div>
          <div>
            <p className="font-semibold text-gray-900">Meta da semana</p>
            <p className="text-xs text-gray-500">
              {achieved
                ? `Batida! +${goal.rewardPoints} pts creditados`
                : remaining === 1 ? 'Falta 1 tarefa' : `Faltam ${remaining} tarefas`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">
            {goal.completed}<span className="text-base font-medium text-gray-400">/{goal.target}</span>
          </p>
          {!achieved && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">+{goal.rewardPoints} pts em jogo</p>
          )}
        </div>
      </div>

      <div
        className="h-2.5 overflow-hidden rounded-full bg-gray-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal.target}
        aria-valuenow={Math.min(goal.completed, goal.target)}
        aria-label="Progresso da meta da semana"
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ${achieved ? 'bg-lime-500' : 'bg-gradient-to-r from-brand-600 to-lime-400'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="mt-3 text-xs text-gray-500">{explainWeeklyGoal(goal)}</p>
    </div>
  );
}
