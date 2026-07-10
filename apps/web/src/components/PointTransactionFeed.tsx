import { PointReason, type PointTransaction } from '@prodscore/shared';
import { CheckCircleIcon, FlameIcon, ExclamationTriangleIcon, FlagIcon, TrophyIcon } from './icons.js';

interface PointTransactionFeedProps {
  transactions: PointTransaction[];
}

const REASON_LABELS: Record<PointReason, string> = {
  [PointReason.TaskCompleted]:    'Tarefa concluída',
  [PointReason.StreakBonus]:      'Bônus de sequência',
  [PointReason.LatePenalty]:      'Penalidade por atraso',
  [PointReason.MissionReward]:    'Recompensa de missão',
  [PointReason.AchievementBonus]: 'Conquista desbloqueada',
};

type IconComponent = React.FC<{ className?: string }>;

const REASON_ICONS: Record<PointReason, IconComponent> = {
  [PointReason.TaskCompleted]:    CheckCircleIcon,
  [PointReason.StreakBonus]:      FlameIcon,
  [PointReason.LatePenalty]:      ExclamationTriangleIcon,
  [PointReason.MissionReward]:    FlagIcon,
  [PointReason.AchievementBonus]: TrophyIcon,
};

const REASON_ICON_COLORS: Record<PointReason, string> = {
  [PointReason.TaskCompleted]:    'text-green-500',
  [PointReason.StreakBonus]:      'text-amber-500',
  [PointReason.LatePenalty]:      'text-red-500',
  [PointReason.MissionReward]:    'text-brand-500',
  [PointReason.AchievementBonus]: 'text-amber-500',
};

export default function PointTransactionFeed({ transactions }: PointTransactionFeedProps) {
  if (transactions.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-500">
        Nenhuma transação ainda
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {transactions.map((tx) => {
        const Icon = REASON_ICONS[tx.reason];
        return (
          <li
            key={tx.id}
            className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 shrink-0 ${REASON_ICON_COLORS[tx.reason]}`} />
              <span className="text-xs text-gray-600">{REASON_LABELS[tx.reason]}</span>
            </div>
            <span className={`text-sm font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {tx.amount >= 0 ? '+' : ''}{tx.amount} pts
            </span>
          </li>
        );
      })}
    </ul>
  );
}
