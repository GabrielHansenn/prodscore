import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useUserStore } from '../store/userStore.js';
import { getFriendsRanking, getGlobalRanking, getWeeklyRanking, refreshRanking, type RankingRow } from '../services/ranking.service.js';
import RankingTable from '../components/RankingTable.js';
import { FlameIcon, UsersIcon } from '../components/icons.js';

type Tab = 'global' | 'semanal' | 'amigos';

async function fetchTab(tab: Tab): Promise<{ rows: RankingRow[]; totalAmigos: number | null }> {
  if (tab === 'amigos') return getFriendsRanking();
  const rows = tab === 'global' ? await getGlobalRanking(50) : await getWeeklyRanking(50);
  return { rows, totalAmigos: null };
}

export default function RankingPage() {
  const navigate              = useNavigate();
  const { user }              = useAuthStore();
  const { stats, fetchStats } = useUserStore();

  const [tab,         setTab]         = useState<Tab>('global');
  const [rows,        setRows]        = useState<RankingRow[]>([]);
  const [totalAmigos, setTotalAmigos] = useState<number | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => { void fetchStats(); }, []);

  useEffect(() => {
    setIsLoading(true);
    setError('');
    setRows([]);
    void (async () => {
      try {
        const data = await fetchTab(tab);
        setRows(data.rows);
        setTotalAmigos(data.totalAmigos);
      } catch {
        setError('Não foi possível carregar o ranking. Tente novamente.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [tab]);

  const myRow = rows.find((r) => r.userId === user?.id);
  const isFriendsTab = tab === 'amigos';
  const hasNoFriends = isFriendsTab && totalAmigos === 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshRanking();
      const data = await fetchTab(tab);
      setRows(data.rows);
      setTotalAmigos(data.totalAmigos);
    } catch {
      setError('Não foi possível atualizar o ranking.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ranking</h1>
          <p className="mt-0.5 text-sm text-gray-500">Compare sua produtividade com outros jogadores</p>
        </div>
        {tab !== 'semanal' && (
          <button
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? 'Atualizando…' : 'Atualizar'}
          </button>
        )}
      </div>

      {/* Posição do usuário */}
      {stats && (
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800/60 dark:bg-brand-900/20">
          <p className="text-xs font-medium text-brand-700 dark:text-brand-300">
            {isFriendsTab ? 'Sua posição entre amigos' : 'Sua posição no ranking global'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-6">
            {isFriendsTab ? (
              <div>
                <p className="text-3xl font-bold text-brand-700 dark:text-brand-300">
                  #{myRow && !myRow.pending ? myRow.position : '—'}
                </p>
                <p className="text-xs text-gray-500">
                  {isLoading ? 'Entre amigos' : `de ${rows.length} ${rows.length === 1 ? 'jogador' : 'jogadores'}`}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-3xl font-bold text-brand-700 dark:text-brand-300">
                  #{stats.rankPosition > 0 ? stats.rankPosition : '—'}
                </p>
                <p className="text-xs text-gray-500">Posição geral</p>
              </div>
            )}
            <div className="h-10 w-px bg-gray-200" />
            <div>
              <p className="text-xl font-bold text-gray-800">
                {stats.totalPoints.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-gray-500">Pontos totais</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xl font-bold text-amber-600 dark:text-amber-400">
                <FlameIcon className="h-5 w-5" />
                {stats.currentStreak}
              </p>
              <p className="text-xs text-gray-500">Sequência atual</p>
            </div>
            <div>
              <p className="text-xl font-bold text-brand-600 dark:text-brand-400">Nível {stats.level}</p>
              <p className="text-xs text-gray-500">Nível atual</p>
            </div>
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
        {([
          { key: 'global',  label: 'Global',  desc: 'Pontuação total acumulada' },
          { key: 'semanal', label: 'Semanal', desc: 'Pontos ganhos nesta semana' },
          { key: 'amigos',  label: 'Amigos',  desc: 'Você e seus amigos' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
              tab === t.key ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{t.label}</span>
            <span className={`ml-1 hidden text-xs md:inline ${tab === t.key ? 'text-brand-200' : 'text-gray-400'}`}>
              — {t.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      ) : hasNoFriends ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center dark:border-gray-700">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
            <UsersIcon className="h-6 w-6" />
          </div>
          <p className="font-semibold text-gray-800">Você ainda não tem amigos para competir</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Adicione amigos para ver quem está mais produtivo e disputar as primeiras posições.
          </p>
          <button
            onClick={() => navigate('/amigos')}
            className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Adicionar amigos
          </button>
        </div>
      ) : (
        <>
          <RankingTable rows={rows} scoreLabel={tab === 'semanal' ? 'Pts na Semana' : 'Pontuação'} {...(user?.id ? { currentUserId: user.id } : {})} />
          {!isFriendsTab && myRow === undefined && user && rows.length > 0 && (
            <p className="mt-3 text-center text-xs text-gray-400">
              Você não está no top 50 ainda — continue completando tarefas!
            </p>
          )}
        </>
      )}
    </div>
  );
}
