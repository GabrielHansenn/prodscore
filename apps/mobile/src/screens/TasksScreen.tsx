import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ScrollView, ActivityIndicator, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TaskDifficulty, TaskStatus } from '@prodscore/shared';
import { useTaskStore } from '../store/taskStore';
import TaskItem from '../components/TaskItem';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

// ---------------------------------------------------------------------------
// Tipos de filtro
// ---------------------------------------------------------------------------

type FilterStatus = TaskStatus | 'all';

const STATUS_CHIPS: Array<{ key: FilterStatus; label: string }> = [
  { key: 'all',                  label: 'Todas'       },
  { key: TaskStatus.Pending,     label: 'Pendentes'   },
  { key: TaskStatus.Completed,   label: 'Concluídas'  },
  { key: TaskStatus.Overdue,     label: 'Atrasadas'   },
  { key: TaskStatus.InProgress,  label: 'Em Andamento' },
];

const DIFF_OPTIONS = [
  { key: TaskDifficulty.Easy,   label: 'Fácil',   pts: 10  },
  { key: TaskDifficulty.Medium, label: 'Médio',   pts: 25  },
  { key: TaskDifficulty.Hard,   label: 'Difícil', pts: 50  },
  { key: TaskDifficulty.Epic,   label: 'Épico',   pts: 100 },
];

// ---------------------------------------------------------------------------
// Modal Bottom Sheet para criar tarefa
// ---------------------------------------------------------------------------

interface CreateModalProps {
  visible:  boolean;
  onClose:  () => void;
  onCreate: (data: { title: string; difficulty: TaskDifficulty; dueDate?: string }) => Promise<void>;
}

function CreateModal({ visible, onClose, onCreate }: CreateModalProps) {
  const [title,      setTitle]      = useState('');
  const [difficulty, setDifficulty] = useState<TaskDifficulty>(TaskDifficulty.Medium);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) { setError('Título é obrigatório.'); return; }
    setError('');
    setLoading(true);
    try {
      await onCreate({ title: title.trim(), difficulty });
      setTitle('');
      setDifficulty(TaskDifficulty.Medium);
      onClose();
    } catch {
      setError('Erro ao criar tarefa.');
    } finally {
      setLoading(false);
    }
  };

  const pts = DIFF_OPTIONS.find((d) => d.key === difficulty)?.pts ?? 25;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.bottomSheet}>
          <View style={styles.handle} />
          <Text style={styles.modalTitle}>Nova Tarefa</Text>

          <Text style={styles.fieldLabel}>Título</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="O que precisa ser feito?"
            placeholderTextColor={COLORS.textMuted}
            autoFocus
          />

          <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Dificuldade</Text>
          <View style={styles.diffRow}>
            {DIFF_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.diffChip, difficulty === opt.key && styles.diffChipActive]}
                onPress={() => setDifficulty(opt.key)}
              >
                <Text style={[styles.diffChipText, difficulty === opt.key && styles.diffChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.ptsPreview}>
            <Text style={styles.ptsText}>Esta tarefa vale <Text style={{ color: COLORS.emerald, fontWeight: '700' }}>{pts} pontos</Text></Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.createBtn, loading && { opacity: 0.6 }]}
            onPress={() => void handleCreate()}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.createBtnText}>Criar Tarefa</Text>
            }
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tela principal
// ---------------------------------------------------------------------------

/** Tela de gerenciamento de tarefas com filtros, swipe e FAB */
export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { tasks, isLoading, fetchTasks, createTask, completeTask, deleteTask } = useTaskStore();

  const [filter,     setFilter]     = useState<FilterStatus>('all');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { void fetchTasks(); }, []);

  const filtered = filter === 'all'
    ? tasks
    : tasks.filter((t) => t.status === filter);

  const handleComplete = async (id: string) => {
    try { await completeTask(id); } catch { /* erros silenciados — UI já reverteu */ }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Minhas Tarefas</Text>
        <Text style={styles.headerCount}>{tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}</Text>
      </View>

      {/* Chips de filtro de status */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        {STATUS_CHIPS.map((chip) => {
          const count = chip.key === 'all' ? tasks.length : tasks.filter((t) => t.status === chip.key).length;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chip, filter === chip.key && styles.chipActive]}
              onPress={() => setFilter(chip.key)}
            >
              <Text style={[styles.chipText, filter === chip.key && styles.chipTextActive]}>
                {chip.label} {count > 0 ? `(${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Lista de tarefas */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.emerald} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyText}>Nenhuma tarefa encontrada</Text>
          <Text style={styles.emptyHint}>Toque no + para criar uma nova</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <TaskItem
              task={item}
              onComplete={(id) => void handleComplete(id)}
              onDelete={(id) => void deleteTask(id)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + SPACING.lg }]}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <CreateModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={createTask}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.background },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', padding: SPACING.md, paddingBottom: SPACING.sm },
  headerTitle: { fontSize: FONT.xl, fontWeight: '800', color: COLORS.text },
  headerCount: { fontSize: FONT.sm, color: COLORS.textMuted },

  chipsScroll: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.sm },
  chip:       { paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  chipActive: { backgroundColor: COLORS.emeraldDim, borderColor: COLORS.emerald },
  chipText:   { fontSize: FONT.sm, color: COLORS.textSecondary, fontWeight: '500' },
  chipTextActive: { color: COLORS.emerald, fontWeight: '700' },

  list:   { padding: SPACING.md, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  emptyText:  { fontSize: FONT.lg, fontWeight: '600', color: COLORS.textSecondary },
  emptyHint:  { fontSize: FONT.base, color: COLORS.textMuted },

  fab: {
    position:        'absolute',
    right:           SPACING.lg,
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: COLORS.emerald,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     COLORS.emerald,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.4,
    shadowRadius:    8,
    elevation:       8,
  },
  fabIcon: { fontSize: 28, color: '#fff', fontWeight: '300', lineHeight: 32 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  bottomSheet:  { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.sm },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.sm },
  modalTitle:   { fontSize: FONT.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  fieldLabel:   { fontSize: FONT.sm, fontWeight: '500', color: COLORS.textSecondary },
  input:        { backgroundColor: COLORS.input, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: FONT.base, color: COLORS.text },
  diffRow:      { flexDirection: 'row', gap: SPACING.sm },
  diffChip:     { flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  diffChipActive: { borderColor: COLORS.emerald, backgroundColor: COLORS.emeraldDim },
  diffChipText:   { fontSize: FONT.sm, color: COLORS.textMuted, fontWeight: '600' },
  diffChipTextActive: { color: COLORS.emerald },
  ptsPreview:   { backgroundColor: COLORS.emeraldDim, borderRadius: RADIUS.sm, padding: SPACING.sm },
  ptsText:      { fontSize: FONT.sm, color: COLORS.textSecondary },
  errorText:    { color: COLORS.red, fontSize: FONT.sm },
  createBtn:    { backgroundColor: COLORS.emerald, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.xs },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT.md },
});
