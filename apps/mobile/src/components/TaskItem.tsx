import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TaskDifficulty, TaskPriority, TaskStatus, type Task } from '@prodscore/shared';
import { FONT, RADIUS, SPACING, CARD_SHADOW, type ColorPalette } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';
import TaskProofUpload from './TaskProofUpload';
import TaskProofViewer from './TaskProofViewer';

interface TaskItemProps {
  task:       Task;
  onComplete: (id: string) => void;
  onDelete:   (id: string) => void;
  onEdit?:    (task: Task) => void;
}

// Mesma convenção de cores/labels do TaskCard.tsx no web
function getDiffColors(colors: ColorPalette): Record<TaskDifficulty, string> {
  return {
    [TaskDifficulty.Easy]:   colors.success,
    [TaskDifficulty.Medium]: colors.blue,
    [TaskDifficulty.Hard]:   colors.orange,
    [TaskDifficulty.Epic]:   colors.primary400,
  };
}
const DIFF_LABELS: Record<TaskDifficulty, string> = {
  [TaskDifficulty.Easy]: 'Fácil', [TaskDifficulty.Medium]: 'Médio',
  [TaskDifficulty.Hard]: 'Difícil', [TaskDifficulty.Epic]: 'Épico',
};

function getStatusColors(colors: ColorPalette): Record<TaskStatus, string> {
  return {
    [TaskStatus.Pending]:    colors.textMuted,
    [TaskStatus.InProgress]: colors.blue,
    [TaskStatus.Completed]:  colors.success,
    [TaskStatus.Overdue]:    colors.red,
    [TaskStatus.Abandoned]:  colors.textMuted,
  };
}
const STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.Pending]: 'Pendente', [TaskStatus.InProgress]: 'Em Andamento',
  [TaskStatus.Completed]: 'Concluída', [TaskStatus.Overdue]: 'Atrasada', [TaskStatus.Abandoned]: 'Abandonada',
};

function getPriorityBadge(colors: ColorPalette): Partial<Record<TaskPriority, { label: string; color: string }>> {
  return {
    [TaskPriority.Low]:    { label: 'Baixa',   color: colors.textMuted },
    [TaskPriority.High]:   { label: 'Alta',    color: colors.amber },
    [TaskPriority.Urgent]: { label: 'Urgente', color: colors.red },
  };
}

const BASE_POINTS: Record<TaskDifficulty, number> = {
  [TaskDifficulty.Easy]: 10, [TaskDifficulty.Medium]: 25, [TaskDifficulty.Hard]: 50, [TaskDifficulty.Epic]: 100,
};
const PRIORITY_MULT: Record<TaskPriority, number> = {
  [TaskPriority.Low]: 0.9, [TaskPriority.Medium]: 1, [TaskPriority.High]: 1.1, [TaskPriority.Urgent]: 1.25,
};

interface DueInfo { label: string; isOverdue: boolean; isToday: boolean }

function parseDueDate(dueDate: string | null): DueInfo | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMs < 0) {
    const ago = Math.abs(diffDays) || 1;
    return { label: `Atrasada há ${ago} ${ago === 1 ? 'dia' : 'dias'}`, isOverdue: true, isToday: false };
  }
  if (diffMs < 86_400_000) return { label: 'Vence hoje', isOverdue: false, isToday: true };
  if (diffDays === 1) return { label: 'Vence amanhã', isOverdue: false, isToday: false };
  return { label: `Vence em ${diffDays} dias`, isOverdue: false, isToday: false };
}

function getPointsPreview(task: Task): string {
  if (task.status === TaskStatus.Completed && task.pointsEarned !== null) return `+${task.pointsEarned} pts`;
  const base = BASE_POINTS[task.difficulty];
  const withPrio = Math.floor(base * PRIORITY_MULT[task.priority ?? TaskPriority.Medium]);
  if (!task.dueDate) return `+${withPrio} pts`;
  const isOverdue = new Date(task.dueDate) < new Date();
  if (isOverdue) return `+${Math.floor(withPrio * 0.7)} pts (−30% atraso)`;
  return `+${withPrio} pts`;
}

/** Card de tarefa — espelha TaskCard.tsx no web (badges, prazo, pontos, menu editar/excluir) */
export default function TaskItem({ task, onComplete, onDelete, onEdit }: TaskItemProps) {
  const colors = useThemeColors();
  const styles = useStyles();
  const DIFF_COLORS = getDiffColors(colors);
  const STATUS_COLORS = getStatusColors(colors);
  const PRIORITY_BADGE = getPriorityBadge(colors);
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [showProofUpload, setShowProofUpload] = useState(false);
  const isActionable = task.status === TaskStatus.Pending || task.status === TaskStatus.InProgress;
  const isCompleted  = task.status === TaskStatus.Completed;
  const dueInfo      = isCompleted ? null : parseDueDate(task.dueDate);
  const pointsLabel  = getPointsPreview(task);
  const priorityBadge = task.priority ? PRIORITY_BADGE[task.priority] : undefined;

  const handleCompletePress = () => {
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
    <View style={[styles.card, isCompleted && styles.cardCompleted]}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.badgeRow}>
            <View style={[styles.badgePill, { backgroundColor: `${DIFF_COLORS[task.difficulty]}1f` }]}>
              <Text style={[styles.badgeText, { color: DIFF_COLORS[task.difficulty] }]}>{DIFF_LABELS[task.difficulty]}</Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: `${STATUS_COLORS[task.status]}1f` }]}>
              <Text style={[styles.badgeText, { color: STATUS_COLORS[task.status] }]}>{STATUS_LABELS[task.status]}</Text>
            </View>
            {priorityBadge && (
              <View style={[styles.badgePill, { backgroundColor: `${priorityBadge.color}1f` }]}>
                <Text style={[styles.badgeText, { color: priorityBadge.color }]}>{priorityBadge.label}</Text>
              </View>
            )}
          </View>

          <Text style={[styles.title, isCompleted && styles.titleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          {task.description ? (
            <Text style={styles.description} numberOfLines={2}>{task.description}</Text>
          ) : null}
        </View>

        {onEdit && (
          <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.menuBtn} hitSlop={8}>
            <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footerRow}>
        {dueInfo ? (
          <View style={styles.dueRow}>
            <Ionicons
              name={dueInfo.isOverdue ? 'warning-outline' : 'calendar-outline'}
              size={12}
              color={dueInfo.isOverdue ? colors.red : dueInfo.isToday ? colors.amber : colors.textMuted}
            />
            <Text style={[styles.dueText, { color: dueInfo.isOverdue ? colors.red : dueInfo.isToday ? colors.amber : colors.textMuted }]}>
              {dueInfo.label}
            </Text>
          </View>
        ) : <View />}
        <View style={styles.footerRight}>
          {task.requiresProof && !task.hasProof && isActionable && (
            <View style={styles.proofBadge}>
              <Text style={styles.proofBadgeText}>Requer foto</Text>
            </View>
          )}
          {task.hasProof && <TaskProofViewer taskId={task.id} />}
          <Text style={styles.points}>{pointsLabel}</Text>
        </View>
      </View>

      {isActionable && (
        <TouchableOpacity style={styles.completeBtn} onPress={handleCompletePress} activeOpacity={0.8}>
          <Text style={styles.completeBtnText}>Concluir tarefa</Text>
        </TouchableOpacity>
      )}

      {showProofUpload && (
        <TaskProofUpload
          taskId={task.id}
          onUploaded={handleProofUploaded}
          onCancel={() => setShowProofUpload(false)}
        />
      )}

      {/* Menu editar/excluir */}
      <Modal visible={menuOpen} transparent animationType="fade">
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuSheet}>
            <TouchableOpacity
              style={styles.menuItem}
              disabled={isCompleted}
              onPress={() => { setMenuOpen(false); onEdit?.(task); }}
            >
              <Ionicons name="pencil-outline" size={16} color={isCompleted ? colors.textMuted : colors.textSecondary} />
              <Text style={[styles.menuItemText, isCompleted && { color: colors.textMuted }]}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setMenuOpen(false); onDelete(task.id); }}
            >
              <Ionicons name="trash-outline" size={16} color={colors.red} />
              <Text style={[styles.menuItemText, { color: colors.red }]}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     colors.borderSoft,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    gap:             SPACING.sm,
    ...CARD_SHADOW,
  },
  cardCompleted: { opacity: 0.7 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badgePill: { borderRadius: RADIUS.xl, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  title: { fontSize: FONT.base, fontWeight: '600', color: colors.text, marginTop: SPACING.xs, lineHeight: 20 },
  titleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  description: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  menuBtn: { padding: 4 },

  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dueText: { fontSize: 11 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  proofBadge: { backgroundColor: `${colors.primary}1f`, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  proofBadgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  points: { fontSize: 12, fontWeight: '700', color: colors.success },

  completeBtn: { backgroundColor: colors.successDim, borderRadius: RADIUS.md, paddingVertical: 9, alignItems: 'center' },
  completeBtnText: { fontSize: FONT.sm, fontWeight: '600', color: '#047857' },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  menuSheet: { backgroundColor: colors.card, borderRadius: RADIUS.lg, overflow: 'hidden', width: 180, ...CARD_SHADOW },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 13, borderBottomWidth: 1, borderColor: colors.borderSoft },
  menuItemText: { fontSize: FONT.sm, color: colors.text },
}));
