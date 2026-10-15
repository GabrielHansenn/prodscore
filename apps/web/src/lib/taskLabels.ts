import { TaskDifficulty, TaskPriority, TaskStatus } from '@prodscore/shared';

/**
 * Rótulos e cores das tarefas — compartilhados entre o card (TaskCard) e o
 * modal de detalhe (TaskDetailModal) para os dois nunca divergirem.
 */

export const DIFFICULTY_LABELS: Record<TaskDifficulty, string> = {
  [TaskDifficulty.Easy]:   'Fácil',
  [TaskDifficulty.Medium]: 'Médio',
  [TaskDifficulty.Hard]:   'Difícil',
  [TaskDifficulty.Epic]:   'Épico',
};

export const DIFFICULTY_COLORS: Record<TaskDifficulty, string> = {
  [TaskDifficulty.Easy]:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  [TaskDifficulty.Medium]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  [TaskDifficulty.Hard]:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  [TaskDifficulty.Epic]:   'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.Pending]:    'Pendente',
  [TaskStatus.InProgress]: 'Em Andamento',
  [TaskStatus.Completed]:  'Concluída',
  [TaskStatus.Overdue]:    'Atrasada',
  [TaskStatus.Abandoned]:  'Abandonada',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.Pending]:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  [TaskStatus.InProgress]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  [TaskStatus.Completed]:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  [TaskStatus.Overdue]:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  [TaskStatus.Abandoned]:  'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

export const PRIORITY_BADGE: Record<TaskPriority, { label: string; cls: string }> = {
  [TaskPriority.Low]:    { label: 'Baixa',   cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'     },
  [TaskPriority.Medium]: { label: '',         cls: ''                                                                   },
  [TaskPriority.High]:   { label: 'Alta',     cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  [TaskPriority.Urgent]: { label: 'Urgente',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'         },
};
