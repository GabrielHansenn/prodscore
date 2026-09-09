import { useEffect, useState } from 'react';
import { levelThreshold } from '@prodscore/shared';
import { useXpPopupStore } from '../store/xpPopupStore.js';
import { SparklesIcon, TrophyIcon } from './icons.js';

const HOLD_MS      = 3200; // quanto tempo o popup fica visível antes de sumir
const FADE_MS      = 300;  // duração do fade-out
const FILL_MS      = 700;  // duração de cada fase de preenchimento da barra
const LEVEL_UP_GAP = 550;  // pausa entre a barra bater 100% e resetar pro novo nível

/** Progresso (0-100) dentro de um nível, dado o total de pontos */
function progressWithinLevel(level: number, totalPoints: number): number {
  const from  = levelThreshold(level);
  const to    = levelThreshold(level + 1);
  const range = to - from;
  if (range <= 0) return 100;
  return Math.max(0, Math.min(((totalPoints - from) / range) * 100, 100));
}

/**
 * Popup global de ganho de XP — montado uma vez em `App.tsx`. Disparado via
 * `showXpGain()` (store/xpPopupStore.ts) depois de concluir uma tarefa ou
 * missão. Anima a barra do nível anterior pro novo; se houve level up, enche
 * até 100%, destaca "Subiu de nível!" e continua a partir de 0 no novo nível.
 */
export default function XpGainPopup() {
  const current = useXpPopupStore((s) => s.current);
  const dismiss = useXpPopupStore((s) => s.dismiss);

  const [displayLevel, setDisplayLevel] = useState(1);
  const [barPct,       setBarPct]       = useState(0);
  const [showLevelUp,  setShowLevelUp]  = useState(false);
  const [leaving,      setLeaving]      = useState(false);

  useEffect(() => {
    if (!current) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const t = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    setLeaving(false);
    setShowLevelUp(false);
    setDisplayLevel(current.previousLevel);
    setBarPct(progressWithinLevel(current.previousLevel, current.previousTotalPoints));

    if (current.leveledUp) {
      // Fase 1: enche até 100% no nível antigo
      t(() => setBarPct(100), 50);
      // Fase 2: destaque de level up + reset pro novo nível
      t(() => {
        setShowLevelUp(true);
        setDisplayLevel(current.newLevel);
        setBarPct(0);
      }, FILL_MS + LEVEL_UP_GAP);
      // Fase 3: enche a partir de 0 no novo nível
      t(() => setBarPct(progressWithinLevel(current.newLevel, current.newTotalPoints)), FILL_MS + LEVEL_UP_GAP + 50);
    } else {
      t(() => setBarPct(progressWithinLevel(current.newLevel, current.newTotalPoints)), 50);
    }

    // Auto-dismiss
    const totalBeforeHold = current.leveledUp ? FILL_MS + LEVEL_UP_GAP + FILL_MS : FILL_MS;
    t(() => setLeaving(true), totalBeforeHold + HOLD_MS);
    t(() => dismiss(), totalBeforeHold + HOLD_MS + FADE_MS);

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;

  return (
    <div
      className={`fixed left-1/2 top-6 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 transition-all duration-300 ${
        leaving ? '-translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-card-hover dark:border-brand-800/60 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 shrink-0 text-lime-500" />
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              +{current.points} XP
            </span>
          </div>
          <button
            onClick={() => { setLeaving(true); setTimeout(dismiss, FADE_MS); }}
            aria-label="Fechar"
            className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        {current.missionBonus && current.missionBonus.length > 0 && (
          <div className="mt-2 space-y-1">
            {current.missionBonus.map((m, i) => (
              <p key={i} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <TrophyIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                Missão &quot;{m.title}&quot; concluída
                <span className="font-medium text-amber-600 dark:text-amber-400">+{m.points} pts</span>
              </p>
            ))}
          </div>
        )}

        {showLevelUp && (
          <div className="mt-3 rounded-lg bg-gradient-to-r from-brand-600 to-lime-500 px-3 py-1.5 text-center text-sm font-bold text-white animate-pulse">
            🎉 Subiu de nível!
          </div>
        )}

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-semibold text-brand-600 dark:text-brand-400">Nível {displayLevel}</span>
            <span className="text-gray-400 dark:text-gray-500">{Math.round(barPct)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            {/* key={displayLevel}: ao virar de nível, remonta a barra em vez de
                animar de volta 100%→0% — o reset precisa ser instantâneo, só o
                preenchimento seguinte (0%→novo progresso) deve animar. */}
            <div
              key={displayLevel}
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-lime-400 transition-all ease-out"
              style={{ width: `${barPct}%`, transitionDuration: `${FILL_MS}ms` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
