import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  buildHelpSections, helpSectionFromHash, describeAchievementCriteria, formatNumber,
  HELP_SECTION_IDS,
  type HelpBlock, type HelpSection, type HelpSectionId, type LevelReward,
} from '@prodscore/shared';
import HelpCalculator from '../components/help/HelpCalculator.js';
import { AchievementIcon } from '../lib/achievementIcons.js';
import { CheckCircleIcon, LockClosedIcon } from '../components/icons.js';
import Spinner from '../components/Spinner.js';
import {
  getAchievements, getUserAchievements, getLevelRewards, type AchievementItem,
} from '../services/achievement.service.js';

// ---------------------------------------------------------------------------
// Dados do banco (recompensas de nível e conquistas)
// ---------------------------------------------------------------------------

type Loadable<T> = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: T };

/** Carrega uma vez ao abrir a página; o erro aparece só no bloco afetado */
function useLoad<T>(load: () => Promise<T>): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => { if (!cancelled) setState({ status: 'ok', data }); })
      .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

function LoadState({ state }: { state: Loadable<unknown> }) {
  if (state.status === 'loading') return <div className="flex justify-center py-4"><Spinner /></div>;
  return <p className="text-sm text-red-600 dark:text-red-400">Não foi possível carregar agora. Tente de novo mais tarde.</p>;
}

function LevelRewardsBlock({ state }: { state: Loadable<LevelReward[]> }) {
  if (state.status !== 'ok') return <LoadState state={state} />;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {state.data.map((r) => (
        <li key={r.level} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white">Nível {formatNumber(r.level)}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {[
              r.bonusPoints > 0 ? `+${formatNumber(r.bonusPoints)} pontos` : null,
              r.bonusFreezes > 0 ? `+${formatNumber(r.bonusFreezes)} ${r.bonusFreezes === 1 ? 'freeze' : 'freezes'}` : null,
            ].filter(Boolean).join(' e ')}
          </p>
          {r.description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{r.description}</p>}
        </li>
      ))}
    </ul>
  );
}

function AchievementsBlock({ state }: { state: Loadable<{ all: AchievementItem[]; earned: Set<string> }> }) {
  if (state.status !== 'ok') return <LoadState state={state} />;
  const { all, earned } = state.data;
  return (
    <>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
        Você já tem {formatNumber(all.filter((a) => earned.has(a.id)).length)} de {formatNumber(all.length)}.
      </p>
      <ul className="space-y-2">
        {all.map((a) => {
          const has = earned.has(a.id);
          return (
            <li key={a.id} className={`flex gap-3 rounded-xl border p-3 ${has ? 'border-amber-300 bg-amber-50/60 dark:border-amber-700/50 dark:bg-amber-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${has ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-gray-100 dark:bg-gray-700/60'}`}>
                <AchievementIcon iconKey={a.icon} className={`h-5 w-5 ${has ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-semibold text-gray-900 dark:text-white">{a.name}</p>
                  {has ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      <CheckCircleIcon className="h-3 w-3" /> Você já tem
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                      <LockClosedIcon className="h-3 w-3" /> Bloqueada
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-200">{describeAchievementCriteria(a.criteria) ?? a.description}</p>
                {a.rewardPoints > 0 && (
                  <p className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">+{formatNumber(a.rewardPoints)} pontos</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// Blocos de texto (vindos de buildHelpSections, no shared)
// ---------------------------------------------------------------------------

function Block({ block, levelRewards, achievements }: {
  block: HelpBlock;
  levelRewards: Loadable<LevelReward[]>;
  achievements: Loadable<{ all: AchievementItem[]; earned: Set<string> }>;
}) {
  switch (block.type) {
    case 'p':       return <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">{block.text}</p>;
    case 'heading': return <h3 className="pt-1 text-sm font-semibold text-gray-900 dark:text-white">{block.text}</h3>;
    case 'note':
      return (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
          {block.text}
        </p>
      );
    case 'list':
      return (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700 marker:text-gray-400 dark:text-gray-200">
          {block.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      );
    case 'table':
      return (
        <table className="w-full overflow-hidden rounded-xl text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <th scope="col" className="px-3 py-2 font-semibold">{block.head[0]}</th>
              <th scope="col" className="px-3 py-2 font-semibold">{block.head[1]}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {block.rows.map(([a, b]) => (
              <tr key={a}>
                <th scope="row" className="whitespace-nowrap px-3 py-2 text-left align-top font-medium text-gray-900 dark:text-white">{a}</th>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'faq':
      return (
        <dl className="space-y-3">
          {block.items.map(({ q, a }) => (
            <div key={q}>
              <dt className="text-sm font-semibold text-gray-900 dark:text-white">{q}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-gray-700 dark:text-gray-200">{a}</dd>
            </div>
          ))}
        </dl>
      );
    case 'calculator':   return <HelpCalculator />;
    case 'levelRewards': return <LevelRewardsBlock state={levelRewards} />;
    case 'achievements': return <AchievementsBlock state={achievements} />;
  }
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

/**
 * Página de Ajuda: como funcionam os pontos e toda a gamificação, em
 * linguagem simples. Seções em acordeão (a primeira aberta). Um atalho "?"
 * leva para /ajuda#secao — a seção abre e a página rola até ela.
 */
export default function HelpPage() {
  const { hash } = useLocation();
  const sections: HelpSection[] = useMemo(() => buildHelpSections(), []);
  const target = helpSectionFromHash(hash);
  const [open, setOpen] = useState<Set<HelpSectionId>>(() => new Set([target ?? HELP_SECTION_IDS[0]!]));

  const levelRewards = useLoad(getLevelRewards);
  const achievements = useLoad(async () => {
    const [all, mine] = await Promise.all([getAchievements(), getUserAchievements()]);
    return { all, earned: new Set(mine.map((a) => a.id)) };
  });

  // Chegou por um atalho (ou o #hash mudou com a página aberta): abre e rola até a seção
  useEffect(() => {
    if (!target) return;
    setOpen((prev) => (prev.has(target) ? prev : new Set(prev).add(target)));
    requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }));
  }, [target]);

  const toggle = (id: HelpSectionId) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ajuda</h1>
        <p className="mt-0.5 text-sm text-gray-500">Como funcionam os pontos, os níveis e tudo o que acontece no ProdScore.</p>
      </div>

      <div className="space-y-3">
        {sections.map((s) => {
          const isOpen = open.has(s.id);
          return (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titulo`} className="card scroll-mt-4 overflow-hidden">
              <h2 id={`${s.id}-titulo`}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`${s.id}-conteudo`}
                  onClick={() => toggle(s.id)}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-gray-900 dark:text-white">{s.title}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{s.summary}</span>
                  </span>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                    className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </h2>
              {isOpen && (
                <div id={`${s.id}-conteudo`} className="space-y-3 border-t border-gray-100 px-4 py-4 dark:border-gray-800">
                  {s.blocks.map((b, i) => <Block key={i} block={b} levelRewards={levelRewards} achievements={achievements} />)}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
