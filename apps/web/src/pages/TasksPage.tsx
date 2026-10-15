import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TaskDifficulty, TaskPriority, TaskStatus, validateRequired, getDescriptionDoc, richTextToPlainText,
  MAX_TASK_DESCRIPTION_LENGTH, localDateKey, endOfLocalDayISO, type Task, type TaskSuggestion, type RichTextDoc,
} from '@prodscore/shared';
import { useTaskStore } from '../store/taskStore.js';
import { showToast } from '../store/toastStore.js';
import { refreshStatsAndShowXpGain } from '../lib/xpGain.js';
import FormFeedback from '../components/FormFeedback.js';
import Modal from '../components/Modal.js';
import ErrorState from '../components/ErrorState.js';
import TaskCard from '../components/TaskCard.js';
import RichTextEditor from '../components/RichTextEditor.js';
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
    /** null limpa a descrição (edição) */
    descriptionRich?:  RichTextDoc | null;
    dueDate?:          string;
    requiresProof?:    boolean;
  }) => Promise<void>;
}

function TaskModal({ task, onClose, onSubmit }: TaskModalProps) {
  const [title,            setTitle]            = useState(task?.title            ?? '');
  // Tarefas antigas (texto puro) abrem no editor convertidas, sem mudar a aparência
  const [description,      setDescription]      = useState<RichTextDoc | null>(() => (task ? getDescriptionDoc(task) : null));
  const [difficulty,       setDifficulty]       = useState<TaskDifficulty>(task?.difficulty ?? TaskDifficulty.Medium);
  const [priority,         setPriority]         = useState<TaskPriority>(task?.priority ?? TaskPriority.Medium);
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(task?.estimatedMinutes?.toString() ?? '');
  const [dueDate,          setDueDate]          = useState(task?.dueDate ? localDateKey(new Date(task.dueDate)) : '');
  const [requiresProof,    setRequiresProof]    = useState(task?.requiresProof ?? false);
  const [error,            setError]            = useState('');
  const [loading,          setLoading]          = useState(false);

  const isEdit      = task !== null;
  const isCompleted = task?.status === TaskStatus.Completed;
  const pts         = Math.floor(BASE_POINTS[difficulty] * PRIORITY_MULT[priority]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const titleError = validateRequired(title, 'Título');
    if (titleError) { setError(titleError); return; }
    if (description && richTextToPlainText(description).length > MAX_TASK_DESCRIPTION_LENGTH) {
      setError(`A descrição deve ter no máximo ${MAX_TASK_DESCRIPTION_LENGTH} caracteres.`);
      return;
    }
    setError('');
    setLoading(true);
    try {
      // 23h59 do dia escolhido no fuso do usuário (antes era 23h59 UTC = 20h59 no Brasil)
      const due      = dueDate ? endOfLocalDayISO(dueDate) ?? undefined : undefined;
      const estMins  = estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined;
      await onSubmit({
        title:       title.trim(),
        difficulty,
        priority,
        requiresProof,
        ...(estMins  ? { estimatedMinutes: estMins } : {}),
        // Na edição sempre envia (null = apagou a descrição); na criação só se preenchida
        ...(isEdit || description ? { descriptionRich: description } : {}),
        ...(due      ? { dueDate: due }              : {}),
      });
      onClose();
      showToast(isEdit ? 'Tarefa atualizada com sucesso!' : 'Tarefa criada com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar tarefa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    // Modal padrão: Esc e clique fora fecham; max-h com rolagem para o editor de descrição
    <Modal onClose={onClose} labelledBy="task-modal-title" className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <h2 id="task-modal-title" className="mb-5 text-lg font-semibold text-gray-900">
          {isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}
        </h2>

        {isCompleted && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Tarefas concluídas não podem ser editadas.
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor="task-title" className="mb-1 block text-xs font-medium text-gray-600">Título</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isCompleted}
              placeholder="Ex: Implementar login com OAuth"
              className="input disabled:opacity-50"
            />
          </div>

          <div>
            <p id="task-description-label" className="mb-1 block text-xs font-medium text-gray-600">Descrição (opcional)</p>
            <RichTextEditor
              initialContent={description}
              onChange={setDescription}
              disabled={isCompleted}
              placeholder="Descrição da tarefa"
              heightClassName="min-h-[96px] max-h-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-difficulty" className="mb-1 block text-xs font-medium text-gray-600">Dificuldade</label>
              <select
                id="task-difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as TaskDifficulty)}
                disabled={isCompleted}
                className="input disabled:opacity-50"
              >
                {DIFFICULTY_OPTIONS.filter((o) => o.value !== 'all').map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-priority" className="mb-1 block text-xs font-medium text-gray-600">Prioridade</label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                disabled={isCompleted}
                className="input disabled:opacity-50"
              >
                {Object.values(TaskPriority).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-due" className="mb-1 block text-xs font-medium text-gray-600">Prazo</label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isCompleted}
                min={localDateKey()}
                className="input disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="task-estimate" className="mb-1 block text-xs font-medium text-gray-600">Tempo estimado (min)</label>
              <input
                id="task-estimate"
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                disabled={isCompleted}
                min={1}
                placeholder="Ex: 60"
                className="input disabled:opacity-50"
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

          {error && <FormFeedback variant="error" message={error} />}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading || isCompleted} className="btn-primary flex-1">
              {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar Tarefa'}
            </button>
          </div>
        </form>
    </Modal>
  );
}

export default function TasksPage() {
  const { tasks, isLoading, loadError, fetchTasks, createTask, updateTask, deleteTask, completeTask } = useTaskStore();

  const [activeStatus,     setActiveStatus]     = useState<TaskStatus | 'all'>('all');
  const [activeDifficulty, setActiveDifficulty] = useState<TaskDifficulty | 'all'>('all');
  const [sortBy,           setSortBy]           = useState<'dueDate' | 'points' | 'createdAt'>('createdAt');
  // ?nova=1 abre o formulário direto (ex: botão "Nova tarefa" do Início)
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreateModal,  setShowCreateModal]  = useState(() => searchParams.get('nova') === '1');
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
    try {
      const result = await completeTask(id);
      void refreshStatsAndShowXpGain(result);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao concluir a tarefa.', 'error');
    } finally {
      setCompleting((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  return (
    <div>
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
      ) : loadError ? (
        // Falha ao carregar ≠ "nenhuma tarefa" (antes mostrava "Crie sua primeira tarefa!")
        <ErrorState message={loadError} onRetry={fetchTasks} />
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
                onDelete={(id) => {
                  if (!window.confirm('Excluir esta tarefa permanentemente?')) return;
                  void deleteTask(id).catch((err: unknown) => {
                    showToast(err instanceof Error ? err.message : 'Erro ao excluir a tarefa.', 'error');
                  });
                }}
                onEdit={(t) => setEditingTask(t)}
              />
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <TaskModal
          task={null}
          onClose={() => {
            setShowCreateModal(false);
            if (searchParams.has('nova')) setSearchParams({}, { replace: true });
          }}
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
    </div>
  );
}
