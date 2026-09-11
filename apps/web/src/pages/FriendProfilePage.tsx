import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getFriendStats, type FriendStats } from '../services/friend.service.js';
import StatisticsContent from '../components/StatisticsContent.js';
import FormFeedback from '../components/FormFeedback.js';
import { TrophyIcon } from '../components/icons.js';

/** Perfil de um amigo — mesmas estatísticas da tela própria, com dados do amigo */
export default function FriendProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data,    setData]    = useState<FriendStats | null>(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getFriendStats(id)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Erro ao carregar o perfil.'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <button
        onClick={() => navigate('/amigos')}
        className="mb-5 flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Voltar para amigos
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
        </div>
      ) : error || !data ? (
        <FormFeedback variant="error" message={error || 'Perfil indisponível.'} />
      ) : (
        <>
          {/* Cabeçalho do amigo */}
          <div className="mb-8 flex flex-wrap items-center gap-4">
            {data.usuario.avatarUrl ? (
              <img src={data.usuario.avatarUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-2xl font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {data.usuario.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{data.usuario.username}</h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>Nível {data.usuario.level}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <TrophyIcon className="h-3.5 w-3.5 text-amber-500" />
                  #{data.estatisticas.rankPosition} no ranking
                </span>
              </p>
            </div>
            <button onClick={() => navigate(`/amigos/${data.usuario.id}/chat`)} className="btn-primary ml-auto text-sm">
              Conversar
            </button>
          </div>

          <StatisticsContent stats={data.estatisticas} />
        </>
      )}
    </main>
  );
}
