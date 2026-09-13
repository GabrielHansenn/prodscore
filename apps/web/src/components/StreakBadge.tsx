import { useEffect, useState } from 'react';
import type { FreezeState } from '@prodscore/shared';
import { getFreezeState, armFreeze, disarmFreeze } from '../services/freeze.service.js';
import { showToast } from '../store/toastStore.js';
import { FlameIcon, MoonIcon, TrophyIcon, SnowflakeIcon } from './icons.js';

interface StreakBadgeProps {
  currentStreak:  number;
  longestStreak:  number;
  streakFreezes?: number;
}

/**
 * Card de sequência com o controle de freeze.
 *
 * O freeze não é mais automático: o usuário precisa ARMAR antes de perder o
 * dia (ver freeze.service.ts na API). O card mostra os três estados — saldo,
 * armado e progresso até o próximo freeze.
 */
export default function StreakBadge({ currentStreak, longestStreak, streakFreezes = 0 }: StreakBadgeProps) {
  const isActive = currentStreak > 0;

  const [freeze,  setFreeze]  = useState<FreezeState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getFreezeState()
      .then(({ state }) => setFreeze(state))
      .catch(() => { /* o card continua útil sem o bloco de freeze */ });
  }, [streakFreezes]);

  const handleToggleArm = async () => {
    if (!freeze || loading) return;
    setLoading(true);
    try {
      if (freeze.armedAt) {
        setFreeze(await disarmFreeze());
        showToast('Freeze desarmado.');
      } else {
        setFreeze(await armFreeze());
        showToast('Freeze armado! Seu streak está protegido por 1 dia sem tarefas.');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível concluir a ação.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const balance    = freeze?.balance ?? streakFreezes;
  const maxBalance = freeze?.maxBalance ?? 3;
  const isArmed    = Boolean(freeze?.armedAt);

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
          isActive ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-700'
        }`}>
          {isActive
            ? <FlameIcon className="h-6 w-6 text-amber-500" />
            : <MoonIcon  className="h-6 w-6 text-gray-400"  />
          }
        </div>
        <div>
          <p className="text-xs text-gray-500">Sequência atual</p>
          <p className={`text-3xl font-bold ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
            {currentStreak} <span className="text-base font-normal">{currentStreak === 1 ? 'dia' : 'dias'}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <TrophyIcon className="h-3.5 w-3.5 text-amber-500" />
          <span>
            Recorde pessoal:{' '}
            <span className="font-semibold text-amber-600 dark:text-amber-400">{longestStreak} {longestStreak === 1 ? 'dia' : 'dias'}</span>
          </span>
        </div>

        {/* Saldo + progresso */}
        <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
          <SnowflakeIcon className="h-3.5 w-3.5" />
          <span>
            <span className="font-semibold">{balance} de {maxBalance}</span>{' '}
            {balance === 1 ? 'freeze' : 'freezes'}
            {freeze && (
              freeze.atMaxBalance
                ? <span className="text-gray-400"> · saldo cheio</span>
                : freeze.daysUntilNextFreeze !== null
                  ? <span className="text-gray-400"> · próximo em {freeze.daysUntilNextFreeze} {freeze.daysUntilNextFreeze === 1 ? 'dia' : 'dias'}</span>
                  : <span className="text-gray-400"> · conclua tarefas para ganhar</span>
            )}
          </span>
        </div>

        {/* Estado armado */}
        {isArmed && (
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2 py-1.5 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            <SnowflakeIcon className="h-3.5 w-3.5 shrink-0" />
            <span>Freeze armado — seu streak está protegido.</span>
          </div>
        )}

        {/* Ação */}
        {freeze && (
          <button
            type="button"
            onClick={() => void handleToggleArm()}
            disabled={loading || (!isArmed && balance === 0)}
            title={!isArmed && balance === 0 ? 'Você não tem freezes disponíveis' : undefined}
            className={`mt-1 w-full rounded-lg py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isArmed
                ? 'border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading
              ? 'Aguarde…'
              : isArmed
                ? 'Desarmar freeze'
                : balance === 0
                  ? 'Sem freezes disponíveis'
                  : 'Armar freeze'}
          </button>
        )}

        {!isArmed && balance > 0 && (
          <p className="text-[11px] leading-snug text-gray-400">
            Arme antes de ficar um dia sem concluir tarefas — o freeze não recupera dias já perdidos.
          </p>
        )}
      </div>
    </div>
  );
}
