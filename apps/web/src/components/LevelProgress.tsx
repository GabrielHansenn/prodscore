import { LEVEL_REWARD_MILESTONES } from '@prodscore/shared';

interface LevelProgressProps {
  level:       number;
  totalPoints: number;
}

const BADGE_EMOJI: Record<string, string> = {
  rocket:  '🚀',
  star:    '⭐',
  diamond: '💎',
  crown:   '👑',
  legend:  '🏆',
};

/** Calcula os pontos necessários para cada nível: N² × 100 */
function levelThreshold(n: number): number {
  return n * n * 100;
}

export default function LevelProgress({ level, totalPoints }: LevelProgressProps) {
  const currentThreshold = levelThreshold(level);
  const nextThreshold    = levelThreshold(level + 1);
  const progress         = totalPoints - currentThreshold;
  const range            = nextThreshold - currentThreshold;
  const percentage       = Math.min((progress / range) * 100, 100);

  // Próximo marco de recompensa ainda não atingido
  const nextReward = LEVEL_REWARD_MILESTONES.find((m) => m.level > level) ?? null;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-brand-600 dark:text-brand-400">Nível {level}</span>
        <span className="text-gray-500">
          <span className="font-medium text-gray-900 dark:text-gray-100">{progress.toLocaleString('pt-BR')}</span>
          {' / '}
          {range.toLocaleString('pt-BR')} pts
          <span className="ml-2 text-gray-400">→ Nível {level + 1}</span>
        </span>
      </div>

      <div className="relative h-2.5 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-600 to-lime-400 transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          <span className="font-medium text-lime-700 dark:text-lime-400">{Math.round(percentage)}%</span> completo
        </p>
        {nextReward && (
          <p className="text-xs text-gray-500">
            Nível {nextReward.level}{' '}
            <span className="text-amber-700 dark:text-amber-400">
              {BADGE_EMOJI[nextReward.badgeKey] ?? '🎁'}
              {' '}+{nextReward.bonusPoints} pts
              {nextReward.bonusFreezes > 0 && ` · ${nextReward.bonusFreezes}🧊`}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
