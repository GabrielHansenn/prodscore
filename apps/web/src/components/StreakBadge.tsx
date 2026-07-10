import { FlameIcon, MoonIcon, TrophyIcon } from './icons.js';

interface StreakBadgeProps {
  currentStreak:  number;
  longestStreak:  number;
  streakFreezes?: number;
}

export default function StreakBadge({ currentStreak, longestStreak, streakFreezes = 0 }: StreakBadgeProps) {
  const isActive = currentStreak > 0;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
          isActive ? 'bg-amber-100' : 'bg-gray-100'
        }`}>
          {isActive
            ? <FlameIcon className="h-6 w-6 text-amber-500" />
            : <MoonIcon  className="h-6 w-6 text-gray-400"  />
          }
        </div>
        <div>
          <p className="text-xs text-gray-500">Sequência atual</p>
          <p className={`text-3xl font-bold ${isActive ? 'text-amber-600' : 'text-gray-400'}`}>
            {currentStreak} <span className="text-base font-normal">{currentStreak === 1 ? 'dia' : 'dias'}</span>
          </p>
        </div>
      </div>
      <div className="mt-3 border-t border-gray-100 pt-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <TrophyIcon className="h-3.5 w-3.5 text-amber-500" />
          <span>
            Recorde pessoal:{' '}
            <span className="font-semibold text-amber-600">{longestStreak} {longestStreak === 1 ? 'dia' : 'dias'}</span>
          </span>
        </div>
        {streakFreezes > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-blue-500">
            <span>🧊</span>
            <span>
              {streakFreezes} {streakFreezes === 1 ? 'freeze disponível' : 'freezes disponíveis'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
