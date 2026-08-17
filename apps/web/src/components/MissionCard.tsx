import type { Mission } from '@prodscore/shared';
import { MissionType } from '@prodscore/shared';
import { UsersIcon, BoltIcon } from './icons.js';

interface MissionCardProps {
  mission:          Mission;
  isParticipating?: boolean;
  onJoin?:          (id: string) => void;
}

function formatTimeLeft(expiresAt: string | null): string {
  if (!expiresAt) return 'Sem prazo';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expirada';
  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d restante${days !== 1 ? 's' : ''}`;
  return `${hours}h restante${hours !== 1 ? 's' : ''}`;
}

export default function MissionCard({ mission, isParticipating = false, onJoin }: MissionCardProps) {
  const pct       = Math.min((mission.currentValue / mission.targetValue) * 100, 100);
  const timeLeft  = formatTimeLeft(mission.expiresAt);
  const isExpired = timeLeft === 'Expirada';
  const isGroup   = mission.type === MissionType.Group;

  return (
    <div className="card p-4 transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {isGroup
              ? <UsersIcon className="h-4 w-4 shrink-0 text-brand-500" />
              : <BoltIcon  className="h-4 w-4 shrink-0 text-amber-500" />
            }
            <h3 className="font-semibold text-gray-900">{mission.title}</h3>
          </div>
          {mission.description && (
            <p className="mt-1 text-xs text-gray-500">{mission.description}</p>
          )}
        </div>
        <div className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          +{mission.rewardPoints} pts
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-gray-500">
          <span>{mission.currentValue} / {mission.targetValue}</span>
          <span className={isExpired ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}>{timeLeft}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {!isParticipating && !mission.isCompleted && !isExpired && onJoin && (
        <button
          onClick={() => onJoin(mission.id)}
          className="mt-3 w-full rounded-lg bg-brand-50 py-1.5 text-sm font-medium text-brand-600 transition-all hover:bg-brand-100 dark:bg-brand-900/20 dark:text-brand-300 dark:hover:bg-brand-900/40"
        >
          Participar
        </button>
      )}

      {mission.isCompleted && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
          <CheckCircleInline />
          Missão concluída!
        </div>
      )}
    </div>
  );
}

function CheckCircleInline() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
