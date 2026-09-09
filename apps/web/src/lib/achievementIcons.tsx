import {
  CheckCircleIcon, FlameIcon, SparklesIcon, GemIcon, ClipboardIcon, RocketIcon,
  BoltIcon, ClockIcon, UsersIcon, CrownIcon, MedalIcon, StarIcon,
  ArrowTrendingUpIcon, ShieldIcon, CoinsIcon, FlagIcon, TrophyIcon,
} from '../components/icons.js';

type IconComponent = (props: { className?: string }) => JSX.Element;

/**
 * Mapa de chave semântica -> componente de ícone (ver `supabase/seed.sql`
 * para o catálogo completo). Usado tanto pelo card de conquista quanto pelo
 * popup de "conquista desbloqueada" — um só lugar de verdade pros dois não
 * divergirem.
 */
export const ACHIEVEMENT_ICONS: Record<string, IconComponent> = {
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

export function AchievementIcon({ iconKey, className = '' }: { iconKey: string; className?: string }) {
  const Icon = ACHIEVEMENT_ICONS[iconKey] ?? TrophyIcon;
  return <Icon className={className} />;
}
