import type { AchievementItem } from '../services/achievement.service.js';

interface AchievementCardProps {
  achievement: AchievementItem;
  earned:      boolean;
  earnedAt?:   string;
  /** Progresso atual para conquistas com critério numérico */
  progress?:   number;
}

/** Card de conquista com visual completo (desbloqueada) ou em escala de cinza (bloqueada) */
export default function AchievementCard({
  achievement,
  earned,
  earnedAt,
  progress,
}: AchievementCardProps) {
  const threshold = achievement.criteria?.threshold ?? 0;
  const pct       = progress !== undefined && threshold > 0
    ? Math.min((progress / threshold) * 100, 100)
    : 0;

  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${
      earned
        ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50'
        : 'border-gray-800 bg-gray-900 opacity-60 grayscale hover:opacity-80 hover:grayscale-0'
    }`}>
      {/* Ícone */}
      <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${
        earned ? 'bg-amber-500/20' : 'bg-gray-800'
      }`}>
        {achievement.icon}
      </div>

      {/* Título e descrição */}
      <h3 className={`font-semibold leading-tight ${earned ? 'text-gray-100' : 'text-gray-400'}`}>
        {achievement.name}
      </h3>
      <p className="mt-1 text-xs text-gray-500 leading-relaxed">{achievement.description}</p>

      {/* Recompensa */}
      <div className="mt-3 flex items-center justify-between">
        <span className={`text-xs font-medium ${earned ? 'text-amber-400' : 'text-gray-600'}`}>
          +{achievement.rewardPoints} pts
        </span>
        {earned && earnedAt ? (
          <span className="text-xs text-amber-500/70">
            {new Date(earnedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </span>
        ) : (
          !earned && achievement.criteria && (
            <span className="text-xs text-gray-600">
              {progress ?? 0}/{threshold}
            </span>
          )
        )}
      </div>

      {/* Barra de progresso para conquistas bloqueadas */}
      {!earned && threshold > 0 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-gray-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Selo de conquistado */}
      {earned && (
        <div className="mt-2 text-right">
          <span className="text-xs font-medium text-amber-400">✓ Conquistada</span>
        </div>
      )}
    </div>
  );
}
