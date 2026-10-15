import { TaskDifficulty, TaskPriority, TaskStatus } from '@prodscore/shared';
import type { ColorPalette } from '../constants/theme';

/**
 * Rótulos e cores das tarefas — compartilhados entre o item da lista
 * (TaskItem) e o modal de detalhe (TaskDetailModal). Mesma convenção do web.
 */

export function getDiffColors(colors: ColorPalette): Record<TaskDifficulty, string> {
  return {
    [TaskDifficulty.Easy]:   colors.success,
    [TaskDifficulty.Medium]: colors.blue,
    [TaskDifficulty.Hard]:   colors.orange,
    [TaskDifficulty.Epic]:   colors.primary400,
  };
}

export const DIFF_LABELS: Record<TaskDifficulty, string> = {
  [TaskDifficulty.Easy]: 'Fácil', [TaskDifficulty.Medium]: 'Médio',
  [TaskDifficulty.Hard]: 'Difícil', [TaskDifficulty.Epic]: 'Épico',
};

export function getStatusColors(colors: ColorPalette): Record<TaskStatus, string> {
  return {
    [TaskStatus.Pending]:    colors.textMuted,
    [TaskStatus.InProgress]: colors.blue,
    [TaskStatus.Completed]:  colors.success,
    [TaskStatus.Overdue]:    colors.red,
    [TaskStatus.Abandoned]:  colors.textMuted,
  };
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.Pending]: 'Pendente', [TaskStatus.InProgress]: 'Em Andamento',
  [TaskStatus.Completed]: 'Concluída', [TaskStatus.Overdue]: 'Atrasada', [TaskStatus.Abandoned]: 'Abandonada',
};

export function getPriorityBadge(colors: ColorPalette): Partial<Record<TaskPriority, { label: string; color: string }>> {
  return {
    [TaskPriority.Low]:    { label: 'Baixa',   color: colors.textMuted },
    [TaskPriority.High]:   { label: 'Alta',    color: colors.amber },
    [TaskPriority.Urgent]: { label: 'Urgente', color: colors.red },
  };
}
