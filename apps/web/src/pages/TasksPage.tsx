import { useEffect, useState, type FormEvent } from 'react';
import { TaskDifficulty, TaskPriority, TaskStatus, type Task, type TaskSuggestion } from '@prodscore/shared';
import { useTaskStore } from '../store/taskStore.js';
import TaskCard from '../components/TaskCard.js';
import { ClipboardIcon, SparklesIcon } from '../components/icons.js';
import { getTaskSuggestions } from '../services/behavioral.service.js';

const STATUS_TABS: Array<{ value: TaskStatus | 'all'; label: string }> = [
  { value: 'all',                  label: 'Todas'        },
  { value: TaskStatus.Pending,     label: 'Pendentes'    },
  { value: TaskStatus.InProgress,  label: 'Em Andamento' },
  { value: TaskStatus.Completed,   label: 'Concluídas'   },
  { value: TaskStatus.Overdue,     label: 'Atrasadas'    },
  { value: TaskStatus.Abandoned,   label: 'Abandonadas'  },
];

const DIFFICULTY_OPTIONS: Array<{ value: TaskDifficulty | 'all'; label: string }> = [
  { value: 'all',              label: 'Todas as dificuldades' },
  { value: TaskDifficulty.Easy,   label: 'Fácil'  },
  { value: TaskDifficulty.Medium, label: 'Médio'  },
  { value: TaskDifficulty.Hard,   label: 'Difícil' },
  { value: TaskDifficulty.Epic,   label: 'Épico'  },
];

const BASE_POINTS: Record<TaskDifficulty, number> = {
  [TaskDifficulty.Easy]:   10,
  [TaskDifficulty.Medium]: 25,
  [TaskDifficulty.Hard]:   50,
  [TaskDifficulty.Epic]:   100,
};

const PRIORITY_MULT: Record<TaskPriority, number> = {
  [TaskPriority.Low]:    0.90,
  [TaskPriority.Medium]: 1.00,
  [TaskPriority.High]:   1.10,
  [TaskPriority.Urgent]: 1.25,
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.Low]:    'Baixa',
  [TaskPriority.Medium]: 'Média',
  [TaskPriority.High]:   'Alta',
  [TaskPriority.Urgent]: 'Urgente',
};

interface TaskModalProps {
  task:     Task | null;
  onClose:  () => void;
  onSubmit: (data: {
    title:             string;
    difficulty:        TaskDifficulty;
    priority:          TaskPriority;
    estimatedMinutes?: number;
    description?:      string;
    dueDate?:          string;
    requiresProof?:    boolean;
  }) => Promise<void>;
}

function TaskModal({ task, onClose, onSubmit }: TaskModalProps) {
  const [title,            setTitle]            = useState(task?.title            ?? '');
  const [description,      setDescription]      = useState(task?.description      ?? '');
  const [difficulty,       setDifficulty]       = useState<TaskDifficulty>(task?.difficulty ?? TaskDifficulty.Medium);
  const [priority,         setPriority]         = useState<TaskPriority>(task?.priority ?? TaskPriority.Medium);
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(task?.estimatedMinutes?.toString() ?? '');
  const [dueDate,          setDueDate]          = useState(task?.dueDate ? task.dueDate.split('T')[0]! : '');
  const [requiresProof,    setRequiresProof]    = useState(task?.requiresProof ?? false);
  const [error,            setError]            = useState('');
  const [loading,          setLoading]          = useState(false);

  const isEdit      = task !== null;
  const isCompleted = task?.status === TaskStatus.Completed;
  const pts         = Math.floor(BASE_POINTS[difficulty] * PRIORITY_MULT[priority]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Título é obrigatório.'); return; }
    setError('');
    setLoading(true);
    try {
      const desc     = description.trim();
      const due      = dueDate ? `${dueDate}T23:59:00.000Z` : undefined;
      const estMins  = estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined;
      await onSubmit({
        title:       title.trim(),
        difficulty,
        priority,
        requiresProof,
        ...(estMins  ? { estimatedMinutes: estMins } : {}),
        ...(desc     ? { description: desc }         : {}),
        ...(due      ? { dueDate: due }              : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar tarefa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <h2 className="mb-5 text-lg font-semibold text-gray-900">
          {isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}
        </h2>

        {isCompleted && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Tarefas concluídas não podem ser editadas.
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isCompleted}
              placeholder="Ex: Implementar login com OAuth"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Descrição (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCompleted}
              rows={3}
              placeholder="Descreva o que precisa ser feito..."
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Dificuldade</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as TaskDifficulty)}
                disabled={isCompleted}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 disabled:opacity-50"
              >
                {DIFFICULTY_OPTIONS.filter((o) => o.value !== 'all').map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                disabled={isCompleted}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 disabled:opacity-50"
              >
                {Object.values(TaskPriority).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Prazo</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isCompleted}
                min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Tempo estimado (min)</label>
              <input
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                disabled={isCompleted}
                min={1}
                placeholder="Ex: 60"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 disabled:opacity-50"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
            <input
              type="checkbox"
              checked={requiresProof}
              onChange={(e) => setRequiresProof(e.target.checked)}
              disabled={isCompleted}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
            />
            Exige comprovação fotográfica para concluir
          </label>

          <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-300">
            Esta tarefa vale <strong>{pts} pontos</strong>
            {priority !== TaskPriority.Medium && (
              <span className="ml-1 text-brand-500">
                ({PRIORITY_MULT[priority] > 1 ? '+' : ''}{Math.round((PRIORITY_MULT[priority] - 1) * 100)}% prioridade)
              </span>
            )}
            {dueDate && ` · +${Math.floor(pts * 0.2)} pts se entregue no prazo`}
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading || isCompleted} className="btn-primary flex-1">
              {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar Tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const { tasks, isLoading, fetchTasks, createTask, updateTask, deleteTask, completeTask } = useTaskStore();

  const [activeStatus,     setActiveStatus]     = useState<TaskStatus | 'all'>('all');
  const [activeDifficulty, setActiveDifficulty] = useState<TaskDifficulty | 'all'>('all');
  const [sortBy,           setSortBy]           = useState<'dueDate' | 'points' | 'createdAt'>('createdAt');
  const [showCreateModal,  setShowCreateModal]  = useState(false);
  const [editingTask,      setEditingTask]      = useState<Task | null>(null);
  const [completing,       setCompleting]       = useState<Set<string>>(new Set());
  const [suggestions,      setSuggestions]      = useState<TaskSuggestion[]>([]);
  const [showSuggestions,  setShowSuggestions]  = useState(true);

  useEffect(() => {
    void fetchTasks();
    void getTaskSuggestions().then(setSuggestions).catch(() => { /* opcional */ });
  }, []);

  let filtered = tasks;
  if (activeStatus !== 'all')     filtered = filtered.filter((t) => t.status === activeStatus);
  if (activeDifficulty !== 'all') filtered = filtered.filter((t) => t.difficulty === activeDifficulty);

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'dueDate') return (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9');
    if (sortBy === 'points')  return BASE_POINTS[b.difficulty] - BASE_POINTS[a.difficulty];
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleComplete = async (id: string) => {
    setCompleting((prev) => new Set(prev).add(id));
    try { await completeTask(id); } finally {
      setCompleting((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Cabeçalho */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Minhas Tarefas</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'} no total
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          + Nova Tarefa
        </button>
      </div>

      {/* Sugestões — Mecânica 7 */}
      {suggestions.length > 0 && showSuggestions && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-900/20">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
              <SparklesIcon className="h-4 w-4" />
              Sugeridas para você
            </h2>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-xs text-brand-500 hover:text-brand-700 dark:text-brand-400"
            >
              Fechar
            </button>
          </div>
          <div className="space-y-2">
            {suggestions.map(({ task, reason }) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm dark:bg-gray-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{task.title}</p>
                  <p className="truncate text-xs text-gray-500">{reason}</p>
                </div>
                <button
                  onClick={() => setEditingTask(task)}
                  className="shrink-0 rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                >
                  Ver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveStatus(tab.value)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeStatus === tab.value
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 ${activeStatus === tab.value ? 'text-brand-200' : 'text-gray-400'}`}>
                {tab.value === 'all' ? tasks.length : tasks.filter((t) => t.status === tab.value).length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={activeDifficulty}
            onChange={(e) => setActiveDifficulty(e.target.value as TaskDifficulty | 'all')}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-brand-500"
          >
            {DIFFICULTY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 outline-none focus:border-brand-500"
          >
            <option value="createdAt">Mais recentes</option>
            <option value="dueDate">Prazo mais próximo</option>
            <option value="points">Mais pontos</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <ClipboardIcon className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 font-medium text-gray-600">Nenhuma tarefa encontrada</p>
          <p className="mt-1 text-sm text-gray-400">
            {activeStatus !== 'all' ? 'Tente outro filtro ou c' : 'C'}rie sua primeira tarefa!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <div key={task.id} className={completing.has(task.id) ? 'pointer-events-none opacity-60' : ''}>
              <TaskCard
                task={task}
                onComplete={(id) => void handleComplete(id)}
                onDelete={(id) => void (window.confirm('Excluir esta tarefa permanentemente?') && deleteTask(id))}
                onEdit={(t) => setEditingTask(t)}
              />
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <TaskModal
          task={null}
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (data) => { await createTask(data); }}
        />
      )}
      {editingTask && (
        <TaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSubmit={async (data) => { if (editingTask) await updateTask(editingTask.id, data); }}
        />
      )}
    </main>
  );
}
