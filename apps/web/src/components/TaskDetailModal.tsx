import { createPortal } from 'react-dom';
import { useEffect, useRef, type ReactNode } from 'react';
import { useScrollLock } from '../lib/useScrollLock.js';
import { TaskStatus, getDescriptionDoc, type Task } from '@prodscore/shared';
import RichText from './RichText.js';
import { CalendarIcon, ClockIcon, CameraIcon, CheckCircleIcon, PencilIcon } from './icons.js';
import {
  DIFFICULTY_COLORS, DIFFICULTY_LABELS, PRIORITY_BADGE, STATUS_COLORS, STATUS_LABELS,
} from '../lib/taskLabels.js';

interface TaskDetailModalProps {
  task:    Task;
  onClose: () => void;
  /** Se informado, mostra o botão "Editar" (tarefas não concluídas) */
  onEdit?: (task: Task) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 shrink-0 text-gray-400">{icon}</span>
      <span className="text-gray-500 dark:text-gray-400">{label}:</span>
      <span className="min-w-0 text-gray-800 dark:text-gray-200">{children}</span>
    </div>
  );
}

/**
 * Detalhe da tarefa — mostra a descrição formatada INTEIRA (o card só exibe
 * uma prévia com "ver mais") e as demais informações.
 */
export default function TaskDetailModal({ task, onClose, onEdit }: TaskDetailModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useScrollLock();
  const description = getDescriptionDoc(task);
  const priority = PRIORITY_BADGE[task.priority];
  const isCompleted = task.status === TaskStatus.Completed;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portal no <body>: fora de cards com opacidade/animação, que deixavam o
  // popup transparente, preso atrás dos outros cards e permitiam abrir vários
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-dialog flex w-full max-w-lg flex-col rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
      >
        {/* Cabeçalho fixo */}
        <div className="flex items-start gap-3 border-b border-gray-100 p-5 dark:border-gray-800">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DIFFICULTY_COLORS[task.difficulty]}`}>
                {DIFFICULTY_LABELS[task.difficulty]}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                {STATUS_LABELS[task.status]}
              </span>
              {priority.label && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priority.cls}`}>
                  Prioridade {priority.label.toLowerCase()}
                </span>
              )}
            </div>
            <h2
              id="task-detail-title"
              className={`mt-2 text-lg font-semibold leading-snug [overflow-wrap:anywhere] ${
                isCompleted ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'
              }`}
            >
              {task.title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Corpo com rolagem própria — descrições longas não empurram o modal pra fora da tela */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Descrição</h3>
            {description ? (
              <RichText doc={description} className="text-sm leading-relaxed text-gray-700 dark:text-gray-300" />
            ) : (
              <p className="text-sm italic text-gray-400">Sem descrição.</p>
            )}
          </section>

          <section className="space-y-2">
            {task.dueDate && (
              <InfoRow icon={<CalendarIcon className="h-4 w-4" />} label="Prazo">
                {formatDateTime(task.dueDate)}
              </InfoRow>
            )}
            {task.estimatedMinutes !== null && (
              <InfoRow icon={<ClockIcon className="h-4 w-4" />} label="Tempo estimado">
                {task.estimatedMinutes} min
              </InfoRow>
            )}
            {task.requiresProof && (
              <InfoRow icon={<CameraIcon className="h-4 w-4" />} label="Comprovação">
                {task.hasProof ? 'Foto anexada' : 'Exige foto para concluir'}
              </InfoRow>
            )}
            {task.completedAt && (
              <InfoRow icon={<CheckCircleIcon className="h-4 w-4" />} label="Concluída em">
                {formatDateTime(task.completedAt)}
                {task.pointsEarned !== null && ` · +${task.pointsEarned} pts`}
              </InfoRow>
            )}
            <p className="pt-1 text-xs text-gray-400">Criada em {formatDateTime(task.createdAt)}</p>
          </section>
        </div>

        {onEdit && !isCompleted && (
          <div className="flex justify-end border-t border-gray-100 p-4 dark:border-gray-800">
            <button
              type="button"
              onClick={() => { onClose(); onEdit(task); }}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <PencilIcon className="h-4 w-4" />
              Editar tarefa
            </button>
          </div>
        )}
      </div>
    </div>
  , document.body);
}
