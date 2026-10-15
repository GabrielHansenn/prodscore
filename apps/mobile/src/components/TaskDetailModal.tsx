import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TaskStatus, getDescriptionDoc, type Task } from '@prodscore/shared';
import RichText from './RichText';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';
import { DIFF_LABELS, STATUS_LABELS, getDiffColors, getPriorityBadge, getStatusColors } from '../lib/taskLabels';

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

/**
 * Detalhe da tarefa — espelho do TaskDetailModal do web. Mostra a descrição
 * formatada INTEIRA (o item da lista só exibe uma prévia com "ver mais").
 */
export default function TaskDetailModal({ task, onClose, onEdit }: TaskDetailModalProps) {
  const colors = useThemeColors();
  const styles = useStyles();
  const description = getDescriptionDoc(task);
  const diffColor = getDiffColors(colors)[task.difficulty];
  const statusColor = getStatusColors(colors)[task.status];
  const priority = getPriorityBadge(colors)[task.priority];
  const isCompleted = task.status === TaskStatus.Completed;

  const infoRows: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }> = [];
  if (task.dueDate) infoRows.push({ icon: 'calendar-outline', label: 'Prazo', value: formatDateTime(task.dueDate) });
  if (task.estimatedMinutes !== null) infoRows.push({ icon: 'time-outline', label: 'Tempo estimado', value: `${task.estimatedMinutes} min` });
  if (task.requiresProof) {
    infoRows.push({ icon: 'camera-outline', label: 'Comprovação', value: task.hasProof ? 'Foto anexada' : 'Exige foto para concluir' });
  }
  if (task.completedAt) {
    const pts = task.pointsEarned !== null ? ` · +${task.pointsEarned} pts` : '';
    infoRows.push({ icon: 'checkmark-circle-outline', label: 'Concluída em', value: `${formatDateTime(task.completedAt)}${pts}` });
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Pressable interno impede que o toque no conteúdo feche o modal */}
        <Pressable style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <View style={[styles.badgePill, { backgroundColor: `${diffColor}1f` }]}>
                  <Text style={[styles.badgeText, { color: diffColor }]}>{DIFF_LABELS[task.difficulty]}</Text>
                </View>
                <View style={[styles.badgePill, { backgroundColor: `${statusColor}1f` }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>{STATUS_LABELS[task.status]}</Text>
                </View>
                {priority && (
                  <View style={[styles.badgePill, { backgroundColor: `${priority.color}1f` }]}>
                    <Text style={[styles.badgeText, { color: priority.color }]}>Prioridade {priority.label.toLowerCase()}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.title, isCompleted && styles.titleDone]}>{task.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityLabel="Fechar">
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Rolagem própria: descrição longa não empurra o modal pra fora da tela */}
          <ScrollView style={styles.body} contentContainerStyle={{ gap: SPACING.md }}>
            <View>
              <Text style={styles.sectionLabel}>DESCRIÇÃO</Text>
              {description
                ? <RichText doc={description} />
                : <Text style={styles.emptyText}>Sem descrição.</Text>}
            </View>

            {infoRows.length > 0 && (
              <View style={{ gap: SPACING.sm }}>
                {infoRows.map((row) => (
                  <View key={row.label} style={styles.infoRow}>
                    <Ionicons name={row.icon} size={16} color={colors.textMuted} />
                    <Text style={styles.infoText}>
                      <Text style={styles.infoLabel}>{row.label}: </Text>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.createdAt}>Criada em {formatDateTime(task.createdAt)}</Text>
          </ScrollView>

          {onEdit && !isCompleted && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => { onClose(); onEdit(task); }}
            >
              <Ionicons name="pencil-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.editBtnText}>Editar tarefa</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.lg },
  sheet: { backgroundColor: colors.card, borderRadius: RADIUS.xl, maxHeight: '85%', overflow: 'hidden', ...CARD_SHADOW },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    padding: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderColor: colors.borderSoft,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badgePill: { borderRadius: RADIUS.xl, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  title: { fontSize: FONT.lg, fontWeight: '700', color: colors.text, marginTop: SPACING.sm, lineHeight: 24 },
  titleDone: { textDecorationLine: 'line-through', color: colors.textMuted },

  body: { padding: SPACING.lg },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 6 },
  emptyText: { fontSize: FONT.base, fontStyle: 'italic', color: colors.textMuted },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  infoText: { flex: 1, fontSize: FONT.sm, color: colors.text, lineHeight: 18 },
  infoLabel: { color: colors.textMuted },
  createdAt: { fontSize: 11, color: colors.textMuted, paddingBottom: SPACING.lg },

  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    borderTopWidth: 1, borderColor: colors.borderSoft, paddingVertical: 14,
  },
  editBtnText: { fontSize: FONT.base, fontWeight: '600', color: colors.textSecondary },
}));
