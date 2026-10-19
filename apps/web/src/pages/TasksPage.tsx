import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TaskDifficulty, TaskPriority, TaskStatus, validateRequired, getDescriptionDoc, richTextToPlainText,
  MAX_TASK_DESCRIPTION_LENGTH, localDateKey, endOfLocalDayISO, calculateTaskPoints, POINTS_BY_DIFFICULTY,
  PRIORITY_MULTIPLIERS, TASK_ESTIMATE_MAX_MINUTES, TASK_DUE_DATE_MAX_DAYS, maxDateFromNow, type Task, type TaskSuggestion, type RichTextDoc,
} from '@prodscore/shared';
import { useTaskStore } from '../store/taskStore.js';
import { showToast } from '../store/toastStore.js';
import { refreshStatsAndShowXpGain } from '../lib/xpGain.js';
import FormFeedback from '../components/FormFeedback.js';
import Modal from '../components/Modal.js';
import ErrorState from '../components/ErrorState.js';
import TaskCard from '../components/TaskCard.js';
import TaskDetailModal from '../components/TaskDetailModal.js';
import RichTextEditor from '../components/RichTextEditor.js';
import { ClipboardIcon, SparklesIcon } from '../components/icons.js';
import { getTaskSuggestions } from '../services/behavioral.service.js';
import Spinner from '../components/Spinner.js';

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
  // Tarefa que já passou do prazo: o prazo não pode ser adiado (a API recusa —
  // senão a conclusão viraria "no prazo" e ganharia bônus em vez de penalidade)
  const isPastDue   = isEdit && !!task?.dueDate && (task.status === TaskStatus.Overdue || new Date(task.dueDate) < new Date());
  const maxDueKey   = localDateKey(maxDateFromNow(TASK_DUE_DATE_MAX_DAYS));
  // Valor real se entregue no prazo (mesma conta da conclusão, no shared)
  const pts         = calculateTaskPoints(difficulty, priority, { kind: 'on_time' });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const titleError = validateRequired(title, 'Título');
    if (titleError) { setError(titleError); return; }
    // Prazo obrigatório: dá senso de urgência (e vale o bônus de entrega no prazo)
    if (!dueDate) { setError('Defina um prazo para a tarefa.'); return; }
    if (!isPastDue && dueDate > maxDueKey) {
      setError(`O prazo pode ser de no máximo ${TASK_DUE_DATE_MAX_DAYS} dias a partir de hoje.`);
      return;
    }
    if (estimatedMinutes && Number(estimatedMinutes) > TASK_ESTIMATE_MAX_MINUTES) {
      setError(`O tempo estimado pode ser de no máximo ${TASK_ESTIMATE_MAX_MINUTES.toLocaleString('pt-BR')} minutos (uma semana).`);
      return;
    }
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
    <Modal onClose={onClose} labelledBy="task-modal-title" className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <h2 id="task-modal-title" className="mb-5 pr-10 text-lg font-semibold text-gray-900">
          {isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}
        </h2>

        {isCompleted && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Tarefas concluídas não podem ser editadas.
          </div>
        )}

        {/* noValidate: as mensagens de erro são as nossas, em português (a validação
            nativa mostrava balões em inglês e bloqueava o envio) */}
        <form noValidate onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor="task-title" className="mb-1 block text-xs font-medium text-gray-600">Título</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isCompleted}
              placeholder="Ex: Estudar para a prova de cálculo"
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
            {/* min-w-0: sem isso a coluna cresce com a largura mínima do campo de data */}
            <div className="min-w-0">
              <label htmlFor="task-due" className="mb-1 block text-xs font-medium text-gray-600">
                Prazo <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="task-due"
                type="date"
                aria-required="true"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isCompleted || isPastDue}
                min={localDateKey()}
                max={maxDueKey}
                aria-describedby={isPastDue ? 'task-due-hint' : undefined}
                className="input disabled:opacity-50"
              />
              {isPastDue && (
                <p id="task-due-hint" className="mt-1 text-xs text-gray-500">Já passou do prazo: não dá para adiar.</p>
              )}
            </div>
            <div>
              <label htmlFor="task-estimate" className="mb-1 block text-xs font-medium text-gray-600">Tempo estimado (min)</label>
              {/* Texto com teclado numérico (e não type="number"): aceita só dígitos e
                  no máximo o tamanho do teto. Com type="number", dezenas de dígitos
                  viravam um balão do navegador em inglês e o formulário parecia travado */}
              <input
                id="task-estimate"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={String(TASK_ESTIMATE_MAX_MINUTES).length}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value.replace(/D/g, '').slice(0, String(TASK_ESTIMATE_MAX_MINUTES).length))}
                disabled={isCompleted}
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
            Entregue no prazo, esta tarefa vale <strong>{pts} pontos</strong>
            {priority !== TaskPriority.Medium && (
              <span className="ml-1 text-brand-500">
                ({PRIORITY_MULTIPLIERS[priority] > 1 ? '+' : ''}{Math.round((PRIORITY_MULTIPLIERS[priority] - 1) * 100)}% prioridade)
              </span>
            )}
          </div>

          {error && <FormFeedback variant="error" message={error} />}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading || isCompleted} className="btn-primary flex-1">
              {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar Tarefa'}
            </button>
          </div>
        </form>

        {/* Botão X no canto: no fim do HTML de propósito, para o Modal continuar
            levando o foco para o campo Título ao abrir (e não para o X) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
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
  // "Ver" nas sugestões abre o detalhe (antes abria direto o formulário de edição)
  const [viewingTask,      setViewingTask]      = useState<Task | null>(null);
  const [completing,       setCompleting]       = useState<Set<string>>(new Set());
  const [suggestions,      setSuggestions]      = useState<TaskSuggestion[]>([]);
  const [showSuggestions,  setShowSuggestions]  = useState(true);

  useEffect(() => {
    void fetchTasks();
    void getTaskSuggestions().then(setSuggestions).catch(() => { /* opcional */ });
  }, []);

  // O "+" da barra inferior navega para ?nova=1 também quando já se está em Tarefas
  // (o useState acima só lê o endereço na primeira vez)
  useEffect(() => {
    if (searchParams.get('nova') === '1') setShowCreateModal(true);
  }, [searchParams]);

  let filtered = tasks;
  if (activeStatus !== 'all')     filtered = filtered.filter((t) => t.status === activeStatus);
  if (activeDifficulty !== 'all') filtered = filtered.filter((t) => t.difficulty === activeDifficulty);

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'dueDate') return (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9');
    if (sortBy === 'points')  return POINTS_BY_DIFFICULTY[b.difficulty] - POINTS_BY_DIFFICULTY[a.difficulty];
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
              className="-mr-2 min-h-[44px] rounded-lg px-2 text-xs text-brand-500 hover:text-brand-700 dark:text-brand-400"
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
                  onClick={() => setViewingTask(task)}
                  className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 sm:min-h-[34px] sm:px-3 sm:text-xs"
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
        {/* Chips de status que quebram linha: todos visíveis sem rolagem lateral
            (antes "Concluídas" e "Atrasadas" ficavam escondidas fora da faixa no celular) */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveStatus(tab.value)}
              aria-pressed={activeStatus === tab.value}
              className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-medium transition-all ${
                activeStatus === tab.value
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800'
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
            className="min-h-[44px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 sm:flex-none"
          >
            {DIFFICULTY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="min-h-[44px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 sm:flex-none"
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
          <Spinner size="md" />
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
      {viewingTask && (
        <TaskDetailModal task={viewingTask} onClose={() => setViewingTask(null)} onEdit={(t) => setEditingTask(t)} />
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
