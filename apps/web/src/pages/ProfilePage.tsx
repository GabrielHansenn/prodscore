import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { useUserStore } from '../store/userStore.js';
import { pointsAtLevelStart, BehavioralProfileType, type BehavioralProfile } from '@prodscore/shared';
import { api } from '../services/api.js';
import ProfileEditForm from '../components/profile/ProfileEditForm.js';
import { FlameIcon } from '../components/icons.js';
import { getBehavioralProfile } from '../services/behavioral.service.js';
import Spinner from '../components/Spinner.js';

interface PointTransaction {
  id:          string;
  amount:      number;
  reason:      string;
  createdAt:   string;
  referenceId: string | null;
}

const REASON_LABELS: Record<string, string> = {
  task_completed:    'Tarefa concluída',
  streak_bonus:      'Bônus de sequência',
  late_penalty:      'Penalidade por atraso',
  mission_reward:    'Recompensa de missão',
  achievement_bonus: 'Bônus de conquista',
  freeze_shop:       'Compra de freeze',
  level_reward:      'Recompensa de nível',
  weekly_goal_reward: 'Meta da semana batida',
  comeback_bonus:    'Bônus de retomada',
};

function LevelProgressBar({ level, totalPoints }: { level: number; totalPoints: number }) {
  const current = pointsAtLevelStart(level);
  const next    = pointsAtLevelStart(level + 1);
  const xp      = Math.max(0, totalPoints - current);
  const pct     = Math.min((xp / (next - current)) * 100, 100);

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-500">
        <span>Nível {level}</span>
        <span className="text-brand-600">{xp} / {next - current} XP</span>
        <span>Nível {level + 1}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-600 to-lime-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componentes de perfil comportamental (Mecânica 1)
// ---------------------------------------------------------------------------

const PROFILE_META: Record<BehavioralProfileType, { emoji: string; label: string; description: string }> = {
  [BehavioralProfileType.EarlyBird]:  { emoji: '🌅', label: 'Madrugador',  description: 'Você é mais produtivo nas primeiras horas da manhã (5h–9h).' },
  [BehavioralProfileType.Morning]:    { emoji: '☀️', label: 'Matutino',    description: 'Seu pico de produtividade é pela manhã (9h–12h).' },
  [BehavioralProfileType.Afternoon]:  { emoji: '🌤️', label: 'Vespertino',  description: 'Você produz mais durante a tarde (12h–17h).' },
  [BehavioralProfileType.Evening]:    { emoji: '🌆', label: 'Noturno',     description: 'Você está no seu melhor no começo da noite (17h–22h).' },
  [BehavioralProfileType.NightOwl]:   { emoji: '🦉', label: 'Coruja',      description: 'Você é mais produtivo de madrugada ou tarde da noite (22h–5h).' },
  [BehavioralProfileType.Undefined]:  { emoji: '🔍', label: 'Indefinido',  description: 'Complete mais tarefas para identificar seu perfil de produtividade.' },
};

// Texto -700 no tema claro e -300 no escuro: o -400 sobre o fundo claro tinha
// contraste baixo. "Procrastinador" em vermelho desestimulava — num app de
// motivação, a tag descreve o hábito sem julgar a pessoa.
const TAG_META: Record<string, { label: string; color: string }> = {
  consistente:    { label: 'Consistente',       color: 'bg-green-500/15 text-green-700 dark:text-green-300' },
  procrastinador: { label: 'Deixa para depois', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  intenso:        { label: 'Intenso',           color: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  metódico:       { label: 'Metódico',          color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  iniciante:      { label: 'Iniciante',         color: 'bg-gray-500/15 text-gray-700 dark:text-gray-300' },
};

function BehavioralProfileCard({ profile }: { profile: BehavioralProfile }) {
  const meta = PROFILE_META[profile.type];
  return (
    <div className="card mb-6 p-6">
      <h3 className="mb-4 font-semibold text-gray-900">Perfil Comportamental</h3>
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-600/10 text-3xl">
          {meta.emoji}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{meta.label}</p>
          <p className="mt-0.5 text-sm text-gray-500">{meta.description}</p>
          {profile.peakHour !== null && (
            <p className="mt-1 text-xs text-gray-400">
              Pico de atividade: {String(profile.peakHour).padStart(2, '0')}h
            </p>
          )}
        </div>
      </div>

      {profile.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.tags.map((tag) => {
            const t = TAG_META[tag] ?? { label: tag, color: 'bg-gray-500/20 text-gray-500' };
            return (
              <span key={tag} className={`rounded-full px-3 py-1 text-xs font-medium ${t.color}`}>
                {t.label}
              </span>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        Baseado nas últimas {profile.totalAnalyzed} tarefas concluídas
      </p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loadSession } = useAuthStore();
  const { stats, fetchStats } = useUserStore();

  const [transactions,       setTransactions]       = useState<PointTransaction[]>([]);
  const [txLoading,          setTxLoading]          = useState(true);
  const [editing,            setEditing]            = useState(false);
  const [behavioralProfile,  setBehavioralProfile]  = useState<BehavioralProfile | null>(null);

  useEffect(() => {
    void fetchStats();
    void (async () => {
      try {
        const { data } = await api.get<{ transacoes: PointTransaction[] }>('/users/me/transactions', { params: { limite: 10 } });
        setTransactions(data.transacoes);
      } catch { /* histórico é opcional */ } finally {
        setTxLoading(false);
      }
    })();
    void getBehavioralProfile().then(setBehavioralProfile).catch(() => { /* opcional */ });
  }, []);

  if (!user) return null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Meu Perfil</h1>

      {/* No modo de edição o formulário substitui o card de identidade: sem foto
          duplicada, e o nível/barra de XP (sem função durante a edição) voltam ao sair */}
      {editing ? (
        <ProfileEditForm
          user={user}
          onCancel={() => setEditing(false)}
          onSaved={async () => { await loadSession(); setEditing(false); }}
        />
      ) : (
      <div className="card mb-6 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-2xl font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
              : user.username.charAt(0).toUpperCase()
            }
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-gray-900">{user.username}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
            {user.bio && <p className="mt-1 text-xs text-gray-400">{user.bio}</p>}
          </div>
        </div>

        {stats && (
          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                Nível {stats.level}
              </span>
              <span className="text-sm font-semibold text-brand-600">
                {stats.totalPoints.toLocaleString('pt-BR')} pts totais
              </span>
            </div>
            <LevelProgressBar level={stats.level} totalPoints={stats.totalPoints} />
          </div>
        )}

        <button
          onClick={() => setEditing(true)}
          className="btn-secondary mt-5"
        >
          Editar perfil
        </button>
      </div>
      )}

      {/* Estatísticas rápidas */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: 'Tarefas Concluídas', value: stats.tasksCompleted,                           color: 'text-green-600',  streak: false },
            { label: 'Sequência Atual',    value: stats.currentStreak,                            color: 'text-amber-600',  streak: true  },
            { label: 'Maior Sequência',    value: `${stats.longestStreak} dias`,                  color: 'text-orange-600', streak: false },
            { label: 'Conquistas',         value: stats.achievementsCount,                        color: 'text-amber-600',  streak: false },
            { label: 'Consistência',       value: `${Math.round(stats.consistencyRate)}%`,        color: 'text-blue-600',   streak: false },
            { label: 'Pts Esta Semana',    value: stats.pointsThisWeek.toLocaleString('pt-BR'),   color: 'text-brand-600',  streak: false },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              {s.streak ? (
                <p className={`flex items-center gap-1 text-xl font-bold ${s.color}`}>
                  <FlameIcon className="h-5 w-5" />{s.value}
                </p>
              ) : (
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              )}
              <p className="mt-0.5 text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Perfil Comportamental — Mecânica 1 */}
      {behavioralProfile && (
        <BehavioralProfileCard profile={behavioralProfile} />
      )}

      {/* Histórico */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="font-semibold text-gray-900">Últimas Transações</h3>
        </div>
        {txLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size="sm" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Nenhuma transação registrada ainda.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-gray-700">{REASON_LABELS[tx.reason] ?? tx.reason}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(tx.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`text-sm font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.amount >= 0 ? '+' : ''}{tx.amount} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
