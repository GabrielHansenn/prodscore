import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MemberRole, TaskDifficulty, TaskPriority, TaskStatus, type Task } from '@prodscore/shared';
import {
  getGroupDetail,
  getGroupMembers,
  getGroupRanking,
  getGroupMissions,
  type GroupDetails,
  type GroupMember,
  type GroupRankingRow,
} from '../services/group.service.js';
import { createGroupMission, type MissionWithParticipation } from '../services/mission.service.js';
import { getTasks, createTask } from '../services/task.service.js';
import { useAuthStore } from '../store/authStore.js';
import RankingTable from '../components/RankingTable.js';
import type { RankingRow } from '../services/ranking.service.js';
import { UsersIcon, ClipboardDocumentIcon, FlameIcon, CogIcon } from '../components/icons.js';

type Tab = 'membros' | 'ranking' | 'missoes' | 'tarefas';

const ROLE_LABELS: Record<MemberRole, string> = {
  [MemberRole.Owner]:  'Dono',
  [MemberRole.Admin]:  'Admin',
  [MemberRole.Member]: 'Membro',
};

const ROLE_STYLES: Record<MemberRole, string> = {
  [MemberRole.Owner]:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  [MemberRole.Admin]:  'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400',
  [MemberRole.Member]: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function MembersList({ members, currentUserId }: { members: GroupMember[]; currentUserId?: string }) {
  if (members.length === 0)
    return <p className="py-10 text-center text-sm text-gray-400">Nenhum membro encontrado.</p>;

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {members.map((m) => {
        const isMe = m.userId === currentUserId;
        return (
          <div
            key={m.userId}
            className={`flex items-center justify-between px-5 py-3.5 transition-colors ${
              isMe ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                isMe ? 'bg-brand-200 text-brand-800 dark:bg-brand-700 dark:text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {m.avatarUrl
                  ? <img src={m.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                  : m.username.charAt(0).toUpperCase()
                }
              </div>
              <div>
                <p className={`text-sm font-medium ${isMe ? 'text-brand-700 dark:text-brand-400' : 'text-gray-800 dark:text-gray-200'}`}>
                  {m.username}
                  {isMe && <span className="ml-1.5 text-xs text-brand-400">(você)</span>}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                  <FlameIcon className="h-3 w-3 text-amber-500" />
                  {m.currentStreak} dias · Nível {m.level}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                {m.totalPoints.toLocaleString('pt-BR')} pts
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[m.role]}`}>
                {ROLE_LABELS[m.role]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GroupMissionCard({ mission }: { mission: MissionWithParticipation }) {
  const pct = mission.targetValue > 0
    ? Math.min((mission.currentValue / mission.targetValue) * 100, 100)
    : 0;
  const isComplete  = mission.isCompleted;
  const expiresDate = mission.expiresAt ? new Date(mission.expiresAt) : null;
  const isExpiring  = expiresDate && (expiresDate.getTime() - Date.now()) < 48 * 3600 * 1000;

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      isComplete
        ? 'border-lime-200 bg-lime-50 dark:border-lime-800/50 dark:bg-lime-900/20'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/60'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`truncate font-medium ${isComplete ? 'text-lime-700 dark:text-lime-400' : 'text-gray-800 dark:text-gray-200'}`}>
            {isComplete && <span className="mr-1.5">✓</span>}
            {mission.title}
          </p>
          {mission.description && (
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 line-clamp-2">{mission.description}</p>
          )}
          {expiresDate && (
            <p className={`mt-1 text-xs ${isExpiring ? 'font-medium text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
              {isExpiring ? '⚠ ' : ''}Encerra {expiresDate.toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
          +{mission.rewardPoints} pts
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{isComplete ? 'Concluída!' : 'Progresso do grupo'}</span>
          <span className="font-medium">{mission.currentValue}/{mission.targetValue}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isComplete ? 'bg-lime-500' : 'bg-gradient-to-r from-brand-600 to-brand-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-right text-xs font-medium text-brand-500 dark:text-brand-400">
          {Math.round(pct)}%
        </p>
      </div>
    </div>
  );
}

function CreateMissionForm({
  onSave, onCancel,
}: {
  onSave: (data: { title: string; description: string; targetValue: number; rewardPoints: number; expiresAt?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [target,   setTarget]   = useState('10');
  const [reward,   setReward]   = useState('50');
  const [expires,  setExpires]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        title,
        description:  desc,
        targetValue:  Number(target),
        rewardPoints: Number(reward),
        ...(expires ? { expiresAt: new Date(expires).toISOString() } : {}),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar missão.');
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800/50 dark:bg-brand-900/20"
    >
      <p className="mb-3 text-sm font-semibold text-brand-700 dark:text-brand-400">Nova missão coletiva</p>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Título *</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Completar 20 tarefas juntos"
            className="input w-full text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Descrição</label>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Opcional"
            className="input w-full text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Meta (tarefas) *</label>
            <input
              required type="number" min={1} max={10000}
              value={target} onChange={(e) => setTarget(e.target.value)}
              className="input w-full text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Recompensa (pts)</label>
            <input
              type="number" min={0}
              value={reward} onChange={(e) => setReward(e.target.value)}
              className="input w-full text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Expira em (opcional)</label>
          <input
            type="datetime-local"
            value={expires} onChange={(e) => setExpires(e.target.value)}
            className="input w-full text-sm"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm disabled:opacity-50">
            {saving ? 'Criando…' : 'Criar missão'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary text-sm">
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Aba de Tarefas do grupo
// ---------------------------------------------------------------------------

const DIFFICULTY_LABEL: Record<TaskDifficulty, string> = {
  [TaskDifficulty.Easy]:   'Fácil',
  [TaskDifficulty.Medium]: 'Média',
  [TaskDifficulty.Hard]:   'Difícil',
  [TaskDifficulty.Epic]:   'Épica',
};

const DIFFICULTY_STYLE: Record<TaskDifficulty, string> = {
  [TaskDifficulty.Easy]:   'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-400',
  [TaskDifficulty.Medium]: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  [TaskDifficulty.Hard]:   'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  [TaskDifficulty.Epic]:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  [TaskStatus.Pending]:    'Pendente',
  [TaskStatus.InProgress]: 'Em andamento',
  [TaskStatus.Completed]:  'Concluída',
  [TaskStatus.Overdue]:    'Atrasada',
  [TaskStatus.Abandoned]:  'Abandonada',
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  [TaskStatus.Pending]:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  [TaskStatus.InProgress]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  [TaskStatus.Completed]:  'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-400',
  [TaskStatus.Overdue]:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  [TaskStatus.Abandoned]:  'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

function GroupTaskCard({ task, onComplete }: { task: Task; onComplete: (t: Task) => void }) {
  const [completing, setCompleting] = useState(false);
  const isDone = task.status === TaskStatus.Completed || task.status === TaskStatus.Abandoned;

  const handleComplete = async () => {
    if (isDone || completing) return;
    setCompleting(true);
    try {
      const { completeTask } = await import('../services/task.service.js');
      const result = await completeTask(task.id);
      onComplete(result.tarefa);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      isDone
        ? 'border-gray-100 bg-gray-50 dark:border-gray-700/50 dark:bg-gray-800/30'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/60'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`font-medium ${isDone ? 'text-gray-400 line-through dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-gray-400 dark:text-gray-500">{task.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DIFFICULTY_STYLE[task.difficulty]}`}>
              {DIFFICULTY_LABEL[task.difficulty]}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[task.status]}`}>
              {STATUS_LABEL[task.status]}
            </span>
            {task.dueDate && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(task.dueDate).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        </div>

        {!isDone && (
          <button
            onClick={() => void handleComplete()}
            disabled={completing}
            title="Concluir tarefa"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:border-lime-400 hover:bg-lime-50 hover:text-lime-600 disabled:opacity-50 dark:border-gray-700 dark:hover:border-lime-600 dark:hover:bg-lime-900/20 dark:hover:text-lime-400"
          >
            {completing ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function GroupTasksTab({
  groupId, tasks, onTaskCreated, onTaskUpdated,
}: {
  groupId: string;
  tasks: Task[];
  onTaskCreated: (t: Task) => void;
  onTaskUpdated: (t: Task) => void;
}) {
  const [showForm, setShowForm]   = useState(false);
  const [title,    setTitle]      = useState('');
  const [diff,     setDiff]       = useState<TaskDifficulty>(TaskDifficulty.Medium);
  const [priority, setPriority]   = useState<TaskPriority>(TaskPriority.Medium);
  const [dueDate,  setDueDate]    = useState('');
  const [desc,     setDesc]       = useState('');
  const [saving,   setSaving]     = useState(false);
  const [error,    setError]      = useState('');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const task = await createTask({
        title:      title.trim(),
        difficulty: diff,
        priority,
        groupId,
        ...(desc.trim()    ? { description: desc.trim() }           : {}),
        ...(dueDate        ? { dueDate: new Date(dueDate).toISOString() } : {}),
      });
      onTaskCreated(task);
      setTitle(''); setDesc(''); setDueDate('');
      setDiff(TaskDifficulty.Medium); setPriority(TaskPriority.Medium);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar tarefa.');
    } finally {
      setSaving(false);
    }
  };

  const pending   = tasks.filter((t) => t.status !== TaskStatus.Completed && t.status !== TaskStatus.Abandoned);
  const completed = tasks.filter((t) => t.status === TaskStatus.Completed);

  return (
    <div className="p-4">
      {/* Botão / formulário de criação */}
      {showForm ? (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800/50 dark:bg-brand-900/20"
        >
          <p className="mb-3 text-sm font-semibold text-brand-700 dark:text-brand-400">Nova tarefa do grupo</p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Título *</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Revisar documentação"
                className="input w-full text-sm"
              />
            </div>

            {desc !== undefined && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Descrição</label>
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Opcional"
                  className="input w-full text-sm"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Dificuldade</label>
                <select value={diff} onChange={(e) => setDiff(e.target.value as TaskDifficulty)} className="input w-full text-sm">
                  <option value={TaskDifficulty.Easy}>Fácil</option>
                  <option value={TaskDifficulty.Medium}>Média</option>
                  <option value={TaskDifficulty.Hard}>Difícil</option>
                  <option value={TaskDifficulty.Epic}>Épica</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Prioridade</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="input w-full text-sm">
                  <option value={TaskPriority.Low}>Baixa</option>
                  <option value={TaskPriority.Medium}>Média</option>
                  <option value={TaskPriority.High}>Alta</option>
                  <option value={TaskPriority.Urgent}>Urgente</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Prazo (opcional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input w-full text-sm"
              />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm disabled:opacity-50">
                {saving ? 'Criando…' : 'Criar tarefa'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 py-3 text-sm font-medium text-brand-600 transition-colors hover:border-brand-500 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-900/20"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Adicionar tarefa ao grupo
        </button>
      )}

      {/* Lista de tarefas ativas */}
      {pending.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Em andamento ({pending.length})
          </p>
          {pending.map((t) => (
            <GroupTaskCard key={t.id} task={t} onComplete={onTaskUpdated} />
          ))}
        </div>
      )}

      {/* Tarefas concluídas */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Concluídas ({completed.length})
          </p>
          {completed.map((t) => (
            <GroupTaskCard key={t.id} task={t} onComplete={onTaskUpdated} />
          ))}
        </div>
      )}

      {/* Estado vazio */}
      {tasks.length === 0 && !showForm && (
        <div className="py-10 text-center">
          <svg className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 002.25 2.25h.75" />
          </svg>
          <p className="mt-2 text-sm text-gray-400">Nenhuma tarefa neste grupo ainda.</p>
          <p className="mt-1 text-xs text-gray-400">Adicione tarefas para registrar sua contribuição!</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function GroupDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { user }  = useAuthStore();

  const [group,    setGroup]    = useState<GroupDetails | null>(null);
  const [members,  setMembers]  = useState<GroupMember[]>([]);
  const [ranking,  setRanking]  = useState<GroupRankingRow[]>([]);
  const [missions, setMissions] = useState<MissionWithParticipation[]>([]);
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [tab,      setTab]      = useState<Tab>('membros');
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [copied,   setCopied]   = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const [detailRes, memsRes, rankRes, missRes, tasksRes] = await Promise.allSettled([
        getGroupDetail(id),
        getGroupMembers(id),
        getGroupRanking(id),
        getGroupMissions(id),
        getTasks({ groupId: id }),
      ]);

      // Grupo é obrigatório — sem ele não tem como renderizar a página
      if (detailRes.status === 'rejected') {
        console.error('[grupo] detalhe falhou:', detailRes.reason);
        setError('Não foi possível carregar o grupo. Verifique se você ainda é membro.');
        setLoading(false);
        return;
      }

      setGroup(detailRes.value);
      if (memsRes.status   === 'fulfilled') setMembers(memsRes.value);
      else console.error('[grupo] membros falhou:', memsRes.reason);
      if (rankRes.status   === 'fulfilled') setRanking(rankRes.value);
      else console.error('[grupo] ranking falhou:', rankRes.reason);
      if (missRes.status   === 'fulfilled') setMissions(missRes.value);
      else console.error('[grupo] missões falhou:', missRes.reason);
      if (tasksRes.status  === 'fulfilled') setTasks(tasksRes.value);
      else console.error('[grupo] tarefas falhou:', tasksRes.reason);

      setLoading(false);
    })();
  }, [id]);

  // group.role já vem do getGroupDetail — confiável mesmo se members falhar
  const myRole  = group?.role;
  const isAdmin = myRole === MemberRole.Owner || myRole === MemberRole.Admin;

  const handleSaveMission = async (data: {
    title: string; description: string; targetValue: number; rewardPoints: number; expiresAt?: string;
  }) => {
    if (!id) return;
    const created = await createGroupMission(id, data);
    setMissions((prev) => [created as unknown as MissionWithParticipation, ...prev]);
    setShowForm(false);
  };

  const copyInviteCode = async () => {
    if (!group?.inviteCode) return;
    await navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rankingRows: RankingRow[] = ranking.map((r) => ({
    position:      r.position,
    userId:        r.userId,
    username:      r.username,
    avatarUrl:     r.avatarUrl,
    level:         r.level,
    score:         r.score,
    currentStreak: r.currentStreak,
  }));

  // ---------------------------------------------------------------------------
  // Estados de carregamento / erro
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <button onClick={() => navigate('/grupos')} className="mb-4 text-xs text-gray-400 hover:text-gray-700">
          ← Voltar para grupos
        </button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800/40 dark:bg-red-900/20">
          <p className="font-medium text-red-600 dark:text-red-400">{error || 'Grupo não encontrado.'}</p>
          <button onClick={() => navigate('/grupos')} className="btn-secondary mt-4">
            Voltar para grupos
          </button>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Render principal
  // ---------------------------------------------------------------------------

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'membros',  label: 'Membros',  count: members.length },
    { key: 'ranking',  label: 'Ranking' },
    { key: 'missoes',  label: 'Missões',  count: missions.length },
    { key: 'tarefas',  label: 'Tarefas',  count: tasks.length },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">

      {/* Voltar */}
      <button
        onClick={() => navigate('/grupos')}
        className="mb-5 flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Voltar para grupos
      </button>

      {/* Cabeçalho do grupo */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {group.imageUrl ? (
            <img src={group.imageUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700">
              <UsersIcon className="h-7 w-7 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{group.name}</h1>
            {group.description && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{group.description}</p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1">
                <UsersIcon className="h-3.5 w-3.5" />
                {group.memberCount} {group.memberCount === 1 ? 'membro' : 'membros'}
              </span>
              {group.activeMissionCount > 0 && (
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  {group.activeMissionCount} missões ativas
                </span>
              )}
              {isAdmin && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {ROLE_LABELS[myRole!]}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Código de convite */}
          {group.inviteCode && (
            <button
              onClick={() => void copyInviteCode()}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <span className="font-mono text-sm font-bold tracking-widest text-brand-600 dark:text-brand-400">
                {group.inviteCode}
              </span>
              <span className={`flex items-center gap-1 text-xs ${copied ? 'text-lime-500' : 'text-gray-400'}`}>
                {copied
                  ? <>✓ Copiado!</>
                  : <><ClipboardDocumentIcon className="h-4 w-4" /> Copiar</>
                }
              </span>
            </button>
          )}

          {/* Configurações — visível a todos os membros (admin/owner veem mais opções lá) */}
          {id && (
            <Link
              to={`/grupos/${id}/configuracoes`}
              title="Configurações do grupo"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:text-gray-300"
            >
              <CogIcon className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800/50">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs leading-none ${
                tab === t.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo das abas */}
      <div className="card overflow-hidden">

        {/* Membros */}
        {tab === 'membros' && (
          <MembersList members={members} {...(user?.id ? { currentUserId: user.id } : {})} />
        )}

        {/* Ranking */}
        {tab === 'ranking' && (
          <div className="p-4">
            {rankingRows.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">Nenhum dado de ranking ainda.</p>
            ) : (
              <RankingTable
                rows={rankingRows}
                scoreLabel="Pontuação"
                {...(user?.id ? { currentUserId: user.id } : {})}
              />
            )}
          </div>
        )}

        {/* Missões */}
        {tab === 'missoes' && (
          <div className="p-4">
            {/* Formulário de criação (admin) */}
            {isAdmin && showForm && (
              <CreateMissionForm
                onSave={handleSaveMission}
                onCancel={() => setShowForm(false)}
              />
            )}

            {/* Botão criar (admin, quando form fechado) */}
            {isAdmin && !showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 py-3 text-sm font-medium text-brand-600 transition-colors hover:border-brand-500 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-900/20"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Criar missão coletiva
              </button>
            )}

            {/* Lista de missões */}
            {missions.length === 0 ? (
              <div className="py-10 text-center">
                <svg className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                <p className="mt-2 text-sm text-gray-400">Nenhuma missão ativa neste grupo.</p>
                {isAdmin && !showForm && (
                  <p className="mt-1 text-xs text-gray-400">Crie uma acima para engajar o grupo!</p>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {missions.map((m) => <GroupMissionCard key={m.id} mission={m} />)}
              </div>
            )}
          </div>
        )}

        {/* Tarefas */}
        {tab === 'tarefas' && id && (
          <GroupTasksTab
            groupId={id}
            tasks={tasks}
            onTaskCreated={(t) => setTasks((prev) => [t, ...prev])}
            onTaskUpdated={(updated) => setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t))}
          />
        )}

      </div>
    </main>
  );
}
