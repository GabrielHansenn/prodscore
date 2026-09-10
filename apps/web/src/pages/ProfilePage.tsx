import { useEffect, useState, type FormEvent } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { useUserStore } from '../store/userStore.js';
import { levelThreshold, BehavioralProfileType, validateUsername, type BehavioralProfile } from '@prodscore/shared';
import { api } from '../services/api.js';
import { getFriendlyErrorMessage } from '../lib/errors.js';
import { useImageUpload, uploadToAvatarsBucket } from '../lib/useImageUpload.js';
import { showToast } from '../store/toastStore.js';
import FormFeedback from '../components/FormFeedback.js';
import ImagePickerField from '../components/ImagePickerField.js';
import { FlameIcon } from '../components/icons.js';
import { getBehavioralProfile } from '../services/behavioral.service.js';

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
};

function LevelProgressBar({ level, totalPoints }: { level: number; totalPoints: number }) {
  const current = levelThreshold(level);
  const next    = levelThreshold(level + 1);
  const pct     = Math.min(((totalPoints - current) / (next - current)) * 100, 100);

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-500">
        <span>Nível {level}</span>
        <span className="text-brand-600">{totalPoints - current} / {next - current} XP</span>
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

const TAG_META: Record<string, { label: string; color: string }> = {
  consistente:    { label: 'Consistente',    color: 'bg-green-500/20 text-green-400 dark:text-green-300' },
  procrastinador: { label: 'Procrastinador', color: 'bg-red-500/20 text-red-400 dark:text-red-300' },
  intenso:        { label: 'Intenso',        color: 'bg-orange-500/20 text-orange-400 dark:text-orange-300' },
  metódico:       { label: 'Metódico',       color: 'bg-blue-500/20 text-blue-400 dark:text-blue-300' },
  iniciante:      { label: 'Iniciante',      color: 'bg-gray-500/20 text-gray-500' },
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
  const [username,           setUsername]           = useState(user?.username ?? '');
  const [bio,                setBio]                = useState(user?.bio ?? '');
  const [saveError,          setSaveError]          = useState('');
  const [saving,             setSaving]             = useState(false);
  const [behavioralProfile,  setBehavioralProfile]  = useState<BehavioralProfile | null>(null);
  const avatarUpload = useImageUpload();

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

  useEffect(() => {
    if (!user) return;
    setUsername(user.username);
    setBio(user.bio ?? '');
  }, [user]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const usernameError = validateUsername(username);
    if (usernameError) { setSaveError(usernameError); return; }
    setSaveError('');
    setSaving(true);
    try {
      let newAvatarUrl: string | undefined;

      if (avatarUpload.file && user) {
        newAvatarUrl = await uploadToAvatarsBucket(user.id, avatarUpload.file, 'avatar');
      }

      try {
        await api.patch('/users/me', {
          username:  username.trim(),
          bio:       bio.trim() || null,
          ...(newAvatarUrl !== undefined ? { avatarUrl: newAvatarUrl } : {}),
        });
      } catch (err) {
        throw new Error(getFriendlyErrorMessage(err, 'Erro ao salvar perfil.'));
      }

      await loadSession();
      avatarUpload.clear();
      setEditing(false);
      showToast('Perfil atualizado com sucesso!');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Meu Perfil</h1>

      {/* Card de identidade */}
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
          onClick={() => setEditing((v) => !v)}
          className="btn-secondary mt-5"
        >
          {editing ? 'Cancelar edição' : 'Editar perfil'}
        </button>
      </div>

      {/* Formulário de edição */}
      {editing && (
        <div className="card mb-6 p-6">
          <h3 className="mb-4 font-semibold text-gray-900">Editar Informações</h3>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nome de usuário</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={30}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Bio (opcional)</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                maxLength={160}
                placeholder="Conte um pouco sobre você..."
                className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
            {/* Upload de avatar */}
            <ImagePickerField
              label="Foto de perfil (opcional)"
              previewUrl={avatarUpload.previewUrl}
              currentUrl={user.avatarUrl}
              fallback={
                <span className="text-2xl font-bold text-brand-700 dark:text-brand-300">
                  {user.username.charAt(0).toUpperCase()}
                </span>
              }
              file={avatarUpload.file}
              inputRef={avatarUpload.inputRef}
              onFileChange={avatarUpload.handleFileChange}
              onClear={avatarUpload.clear}
            />
            {(avatarUpload.error || saveError) && <FormFeedback variant="error" message={avatarUpload.error || saveError} />}
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving
                ? avatarUpload.file ? 'Enviando foto...' : 'Salvando...'
                : 'Salvar alterações'
              }
            </button>
          </form>
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
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
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
    </main>
  );
}
