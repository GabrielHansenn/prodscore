import { useEffect, useState } from 'react';
import { pointsAtLevelStart } from '@prodscore/shared';
import {
  useGamificationPopupStore,
  type XpGainPayload,
  type AchievementPayload,
} from '../store/gamificationPopupStore.js';
import { AchievementIcon } from '../lib/achievementIcons.js';
import { SparklesIcon, TrophyIcon, StarIcon } from './icons.js';

const HOLD_MS_XP          = 3200; // quanto tempo o popup de XP fica visível
const HOLD_MS_ACHIEVEMENT = 4000; // conquista tem mais texto pra ler, fica um pouco mais
const FADE_MS      = 300;  // duração do fade/scale de saída
const FILL_MS      = 700;  // duração de cada fase de preenchimento da barra de XP
const LEVEL_UP_GAP = 550;  // pausa entre a barra bater 100% e resetar pro novo nível

/** Progresso (0-100) dentro de um nível, dado o total de pontos */
function progressWithinLevel(level: number, totalPoints: number): number {
  const from  = pointsAtLevelStart(level);
  const to    = pointsAtLevelStart(level + 1);
  const range = to - from;
  if (range <= 0) return 100;
  return Math.max(0, Math.min(((totalPoints - from) / range) * 100, 100));
}

function XpCard({
  payload, displayLevel, barPct, showLevelUp, onClose,
}: {
  payload: XpGainPayload;
  displayLevel: number;
  barPct: number;
  showLevelUp: boolean;
  onClose: () => void;
}) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-card-hover dark:border-brand-800/60 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 shrink-0 text-lime-500" />
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            +{payload.points} XP
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
        >
          ×
        </button>
      </div>

      {payload.missionBonus && payload.missionBonus.length > 0 && (
        <div className="mt-2 space-y-1">
          {payload.missionBonus.map((m, i) => (
            <p key={i} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <TrophyIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              Missão &quot;{m.title}&quot; concluída
              <span className="font-medium text-amber-600 dark:text-amber-400">+{m.points} pts</span>
            </p>
          ))}
        </div>
      )}

      {showLevelUp && (
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-600 to-lime-500 px-3 py-1.5 text-sm font-bold text-white animate-pulse">
          <StarIcon className="h-4 w-4" />
          Subiu de nível!
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
  );
}

function AchievementCardPopup({ payload, onClose }: { payload: AchievementPayload; onClose: () => void }) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-white p-4 shadow-card-hover dark:border-amber-700/50 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          {/* Glow suave atrás do ícone — só decorativo, sem texto/leitura nele */}
          <div className="absolute inset-0 rounded-full bg-amber-400/40 blur-md" aria-hidden="true" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 ring-2 ring-amber-300 dark:bg-amber-900/40 dark:ring-amber-600/60">
            <AchievementIcon iconKey={payload.icon} className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            <TrophyIcon className="h-3.5 w-3.5" />
            Conquista desbloqueada!
          </div>
          <p className="mt-1 font-bold leading-tight text-gray-900 dark:text-white">{payload.name}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{payload.description}</p>
          {payload.rewardPoints > 0 && (
            <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              +{payload.rewardPoints} pts
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          aria-label="Fechar"
          className="shrink-0 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
        >
          ×
        </button>
      </div>
    </div>
  );
}

/**
 * Popup global de gamificação — montado uma vez em `App.tsx`. Consome a fila
 * única de `gamificationPopupStore.ts` (ganho de XP e conquista desbloqueada),
 * mostrando um item por vez na mesma posição da tela — nunca sobrepostos.
 */
export default function GamificationPopup() {
  const current = useGamificationPopupStore((s) => s.current);
  const advance = useGamificationPopupStore((s) => s.advance);

  const [entered,      setEntered]      = useState(false);
  const [leaving,      setLeaving]      = useState(false);
  const [displayLevel, setDisplayLevel] = useState(1);
  const [barPct,       setBarPct]       = useState(0);
  const [showLevelUp,  setShowLevelUp]  = useState(false);

  const close = () => {
    setLeaving(true);
    setTimeout(advance, FADE_MS);
  };

  useEffect(() => {
    if (!current) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const t = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    setLeaving(false);
    setEntered(false);
    const raf = requestAnimationFrame(() => setEntered(true));

    if (current.kind === 'xp') {
      const xp = current.payload;
      setShowLevelUp(false);
      setDisplayLevel(xp.previousLevel);
      setBarPct(progressWithinLevel(xp.previousLevel, xp.previousTotalPoints));

      if (xp.leveledUp) {
        t(() => setBarPct(100), 50);
        t(() => {
          setShowLevelUp(true);
          setDisplayLevel(xp.newLevel);
          setBarPct(0);
        }, FILL_MS + LEVEL_UP_GAP);
        t(() => setBarPct(progressWithinLevel(xp.newLevel, xp.newTotalPoints)), FILL_MS + LEVEL_UP_GAP + 50);
      } else {
        t(() => setBarPct(progressWithinLevel(xp.newLevel, xp.newTotalPoints)), 50);
      }

      const totalBeforeHold = xp.leveledUp ? FILL_MS + LEVEL_UP_GAP + FILL_MS : FILL_MS;
      t(() => setLeaving(true), totalBeforeHold + HOLD_MS_XP);
      t(advance, totalBeforeHold + HOLD_MS_XP + FADE_MS);
    } else {
      t(() => setLeaving(true), HOLD_MS_ACHIEVEMENT);
      t(advance, HOLD_MS_ACHIEVEMENT + FADE_MS);
    }

    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;

  return (
    <div
      className={`fixed left-1/2 top-6 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 transition-all duration-300 ${
        leaving
          ? '-translate-y-2 scale-95 opacity-0'
          : entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-0 scale-95 opacity-0'
      }`}
    >
      {current.kind === 'xp' ? (
        <XpCard payload={current.payload} displayLevel={displayLevel} barPct={barPct} showLevelUp={showLevelUp} onClose={close} />
      ) : (
        <AchievementCardPopup payload={current.payload} onClose={close} />
      )}
    </div>
  );
}
