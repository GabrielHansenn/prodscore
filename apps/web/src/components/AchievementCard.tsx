import type { AchievementItem } from '../services/achievement.service.js';
import {
  CheckCircleIcon, FlameIcon, SparklesIcon, GemIcon, ClipboardIcon, RocketIcon,
  BoltIcon, ClockIcon, UsersIcon, CrownIcon, MedalIcon, StarIcon,
  ArrowTrendingUpIcon, ShieldIcon, CoinsIcon, FlagIcon, TrophyIcon,
} from './icons.js';

/** Mapa de chave semântica -> componente de ícone. Ver supabase/seed.sql para o catálogo. */
const ICONS: Record<string, (props: { className?: string }) => JSX.Element> = {
  check: CheckCircleIcon,
  flame: FlameIcon,
  sparkle: SparklesIcon,
  gem: GemIcon,
  list: ClipboardIcon,
  rocket: RocketIcon,
  bolt: BoltIcon,
  clock: ClockIcon,
  users: UsersIcon,
  crown: CrownIcon,
  medal: MedalIcon,
  star: StarIcon,
  'trending-up': ArrowTrendingUpIcon,
  shield: ShieldIcon,
  coins: CoinsIcon,
  flag: FlagIcon,
};

function AchievementIcon({ iconKey, className = '' }: { iconKey: string; className?: string }) {
  const Icon = ICONS[iconKey] ?? TrophyIcon;
  return <Icon className={className} />;
}

interface AchievementCardProps {
  achievement: AchievementItem;
  earned:      boolean;
  earnedAt?:   string;
  /** Progresso atual do usuário para o tipo de critério desta conquista (quando disponível) */
  progress?:   number;
}

/** Card de conquista — visual com acento âmbar quando desbloqueada, neutro quando bloqueada. */
export default function AchievementCard({
  achievement,
  earned,
  earnedAt,
  progress,
}: AchievementCardProps) {
  const threshold = achievement.criteria?.threshold ?? 0;
  const hasProgress = !earned && progress !== undefined && threshold > 0;
  const pct = hasProgress ? Math.min((progress! / threshold) * 100, 100) : 0;

  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${
      earned
        ? 'border-amber-300 bg-amber-50/60 hover:border-amber-400 dark:border-amber-700/50 dark:bg-amber-900/10 dark:hover:border-amber-600/70'
        : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-gray-600'
    }`}>
      <div className="flex items-start justify-between gap-2">
        {/* Ícone */}
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
          earned
            ? 'bg-amber-100 dark:bg-amber-900/40'
            : 'bg-gray-100 dark:bg-gray-700/60'
        }`}>
          <AchievementIcon
            iconKey={achievement.icon}
            className={`h-6 w-6 ${earned ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}
          />
        </div>

        {earned && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <CheckCircleIcon className="h-3 w-3" />
            Conquistada
          </span>
        )}
      </div>

      {/* Título e descrição */}
      <h3 className={`mt-3 font-semibold leading-tight ${
        earned ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'
      }`}>
        {achievement.name}
      </h3>
      <p className={`mt-1 text-xs leading-relaxed ${
        earned ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'
      }`}>
        {achievement.description}
      </p>

      {/* Progresso (só quando temos o dado do usuário pra esse tipo de critério) */}
      {hasProgress && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-500 dark:bg-amber-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[11px] text-gray-400 dark:text-gray-500">
            {Math.min(progress!, threshold)}/{threshold}
          </p>
        </div>
      )}

      {/* Rodapé: pontos + data de conquista */}
      <div className="mt-3 flex items-center justify-between">
        <span className={`text-xs font-medium ${
          earned ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'
        }`}>
          +{achievement.rewardPoints} pts
        </span>
        {earned && earnedAt && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {new Date(earnedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}
