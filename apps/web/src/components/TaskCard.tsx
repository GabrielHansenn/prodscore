import { useState } from 'react';
import { TaskDifficulty, TaskPriority, TaskStatus, getDescriptionDoc, type Task } from '@prodscore/shared';
import { FlameIcon, CalendarIcon, ExclamationTriangleIcon, PencilIcon, TrashIcon } from './icons.js';
import TaskProofUpload from './TaskProofUpload.js';
import TaskProofViewer from './TaskProofViewer.js';
import RichTextPreview from './RichTextPreview.js';
import TaskDetailModal from './TaskDetailModal.js';
import {
  DIFFICULTY_COLORS, DIFFICULTY_LABELS, PRIORITY_BADGE, STATUS_COLORS, STATUS_LABELS,
} from '../lib/taskLabels.js';

interface TaskCardProps {
  task:        Task;
  onComplete:  (id: string) => void;
  onDelete:    (id: string) => void;
  onEdit?:     (task: Task) => void;
  compact?:    boolean;
}

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

interface DueInfo {
  label:     string;
  isOverdue: boolean;
  isToday:   boolean;
}

function parseDueDate(dueDate: string | null): DueInfo | null {
  if (!dueDate) return null;
  const due      = new Date(dueDate);
  const now      = new Date();
  const diffMs   = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMs < 0) {
    const ago = Math.abs(diffDays) || 1;
    return { label: `Atrasada há ${ago} ${ago === 1 ? 'dia' : 'dias'}`, isOverdue: true, isToday: false };
  }
  if (diffMs < 86_400_000) return { label: 'Vence hoje', isOverdue: false, isToday: true };
  if (diffDays === 1)       return { label: 'Vence amanhã', isOverdue: false, isToday: false };
  return { label: `Vence em ${diffDays} dias`, isOverdue: false, isToday: false };
}

function getPointsPreview(task: Task): string {
  if (task.status === TaskStatus.Completed && task.pointsEarned !== null) {
    return `+${task.pointsEarned} pts`;
  }
  const base     = BASE_POINTS[task.difficulty];
  const prio     = task.priority ?? TaskPriority.Medium;
  const withPrio = Math.floor(base * PRIORITY_MULT[prio]);
  if (!task.dueDate) return `+${withPrio} pts`;
  const isOverdue = new Date(task.dueDate) < new Date();
  if (isOverdue) return `+${Math.floor(withPrio * 0.7)} pts (−30% atraso)`;
  return `+${withPrio} pts (→ +${Math.floor(withPrio * 1.2)} no prazo)`;
}

function DotsVertical() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
  );
}

export default function TaskCard({ task, onComplete, onDelete, onEdit, compact = false }: TaskCardProps) {
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [showProofUpload, setShowProofUpload] = useState(false);
  const [showDetail,      setShowDetail]      = useState(false);

  const isActionable = task.status === TaskStatus.Pending || task.status === TaskStatus.InProgress;
  const dueInfo      = task.status === TaskStatus.Completed ? null : parseDueDate(task.dueDate);
  const pointsLabel  = getPointsPreview(task);
  const description  = getDescriptionDoc(task);

  /** Tarefas com requiresProof exigem a foto antes de concluir de verdade */
  const handleCompleteClick = () => {
    if (task.requiresProof) {
      setShowProofUpload(true);
    } else {
      onComplete(task.id);
    }
  };

  const handleProofUploaded = () => {
    setShowProofUpload(false);
    onComplete(task.id);
  };

  return (
    <div
      className={`card group relative transition-shadow hover:shadow-card-hover ${
        task.status === TaskStatus.Completed ? 'opacity-70' : ''
      } ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[task.difficulty]}`}>
              {DIFFICULTY_LABELS[task.difficulty]}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status]}`}>
              {STATUS_LABELS[task.status]}
            </span>
            {task.priority && PRIORITY_BADGE[task.priority]?.label && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[task.priority]!.cls}`}>
                {PRIORITY_BADGE[task.priority]!.label}
              </span>
            )}
            {dueInfo?.isToday && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <FlameIcon className="h-3 w-3" />
                Bônus de sequência!
              </span>
            )}
          </div>

          {/* Título abre o detalhe com a descrição completa */}
          <button
            type="button"
            onClick={() => setShowDetail(true)}
            className={`mt-2 block w-full text-left font-medium leading-snug [overflow-wrap:anywhere] hover:underline ${
              task.status === TaskStatus.Completed ? 'line-through text-gray-400' : 'text-gray-900'
            }`}
          >
            {task.title}
          </button>

          {!compact && description && (
            <RichTextPreview
              doc={description}
              onShowMore={() => setShowDetail(true)}
              className="mt-1"
            />
          )}
        </div>

        {onEdit && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="-m-2 flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 sm:m-0 sm:h-7 sm:w-7 dark:hover:bg-gray-700"
            >
              <DotsVertical />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(task); }}
                    disabled={task.status === TaskStatus.Completed}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <PencilIcon className="h-4 w-4 text-gray-400" />
                    Editar
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(task.id); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <TrashIcon className="h-4 w-4 text-red-400" />
                    Excluir
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {dueInfo && (
            <span className={`flex items-center gap-1 text-xs ${
              dueInfo.isOverdue ? 'text-red-600 dark:text-red-400' : dueInfo.isToday ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'
            }`}>
              {dueInfo.isOverdue
                ? <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                : <CalendarIcon className="h-3.5 w-3.5" />
              }
              {dueInfo.label}
            </span>
          )}
          {task.requiresProof && !task.hasProof && isActionable && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              Requer foto
            </span>
          )}
          {task.hasProof && <TaskProofViewer taskId={task.id} />}
        </div>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{pointsLabel}</span>
      </div>

      {isActionable && !compact && (
        <button
          onClick={handleCompleteClick}
          className="mt-3 min-h-[44px] w-full rounded-lg bg-emerald-50 py-2 text-sm font-medium text-emerald-700 transition-all duration-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
        >
          Concluir tarefa
        </button>
      )}

      {isActionable && compact && (
        <button
          onClick={handleCompleteClick}
          className="mt-2 min-h-[44px] w-full rounded-lg bg-emerald-50 py-1.5 text-sm font-medium text-emerald-700 transition-all duration-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
        >
          Concluir
        </button>
      )}

      {showProofUpload && (
        <TaskProofUpload
          taskId={task.id}
          onUploaded={handleProofUploaded}
          onCancel={() => setShowProofUpload(false)}
        />
      )}

      {showDetail && (
        <TaskDetailModal
          task={task}
          onClose={() => setShowDetail(false)}
          {...(onEdit ? { onEdit } : {})}
        />
      )}
    </div>
  );
}
