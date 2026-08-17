import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ScrollView, ActivityIndicator, Pressable,
  KeyboardAvoidingView, Platform, Alert, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TaskDifficulty, TaskPriority, TaskStatus, type Task, type TaskSuggestion } from '@prodscore/shared';
import { useTaskStore } from '../store/taskStore';
import { getTaskSuggestions } from '../services/behavioral.service';
import TaskItem from '../components/TaskItem';
import Dropdown from '../components/Dropdown';
import { useResponsive, SIDEBAR_WIDTH } from '../lib/useResponsive';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';

type StatusFilter = TaskStatus | 'all';
type DifficultyFilter = TaskDifficulty | 'all';
type SortBy = 'createdAt' | 'dueDate' | 'points';

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all',                  label: 'Todas'        },
  { value: TaskStatus.Pending,     label: 'Pendentes'    },
  { value: TaskStatus.InProgress,  label: 'Em Andamento' },
  { value: TaskStatus.Completed,   label: 'Concluídas'   },
  { value: TaskStatus.Overdue,     label: 'Atrasadas'    },
  { value: TaskStatus.Abandoned,   label: 'Abandonadas'  },
];

const DIFFICULTY_OPTIONS: Array<{ value: DifficultyFilter; label: string }> = [
  { value: 'all',                    label: 'Todas as dificuldades' },
  { value: TaskDifficulty.Easy,      label: 'Fácil'   },
  { value: TaskDifficulty.Medium,    label: 'Médio'   },
  { value: TaskDifficulty.Hard,      label: 'Difícil' },
  { value: TaskDifficulty.Epic,      label: 'Épico'   },
];

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'createdAt', label: 'Mais recentes'      },
  { value: 'dueDate',   label: 'Prazo mais próximo' },
  { value: 'points',    label: 'Mais pontos'        },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: TaskPriority.Low,    label: 'Baixa'   },
  { value: TaskPriority.Medium, label: 'Média'   },
  { value: TaskPriority.High,   label: 'Alta'    },
  { value: TaskPriority.Urgent, label: 'Urgente' },
];

const BASE_POINTS: Record<TaskDifficulty, number> = {
  [TaskDifficulty.Easy]: 10, [TaskDifficulty.Medium]: 25, [TaskDifficulty.Hard]: 50, [TaskDifficulty.Epic]: 100,
};
const PRIORITY_MULT: Record<TaskPriority, number> = {
  [TaskPriority.Low]: 0.9, [TaskPriority.Medium]: 1, [TaskPriority.High]: 1.1, [TaskPriority.Urgent]: 1.25,
};

// ---------------------------------------------------------------------------
// Modal de criar/editar tarefa — espelha TaskModal do web
// ---------------------------------------------------------------------------

interface TaskModalProps {
  task:     Task | null;
  onClose:  () => void;
  onSubmit: (data: {
    title: string; difficulty: TaskDifficulty; priority: TaskPriority;
    estimatedMinutes?: number; description?: string; dueDate?: string; requiresProof?: boolean;
  }) => Promise<void>;
}

function TaskFormModal({ task, onClose, onSubmit }: TaskModalProps) {
  const [title,          setTitle]          = useState(task?.title ?? '');
  const [description,    setDescription]    = useState(task?.description ?? '');
  const [difficulty,     setDifficulty]     = useState<TaskDifficulty>(task?.difficulty ?? TaskDifficulty.Medium);
  const [priority,       setPriority]       = useState<TaskPriority>(task?.priority ?? TaskPriority.Medium);
  const [estMinutes,     setEstMinutes]     = useState(task?.estimatedMinutes?.toString() ?? '');
  const [dueDate,        setDueDate]        = useState(task?.dueDate ? task.dueDate.split('T')[0]! : '');
  const [requiresProof,  setRequiresProof]  = useState(task?.requiresProof ?? false);
  const [error,          setError]          = useState('');
  const [loading,        setLoading]        = useState(false);

  const isEdit      = task !== null;
  const isCompleted = task?.status === TaskStatus.Completed;
  const pts         = Math.floor(BASE_POINTS[difficulty] * PRIORITY_MULT[priority]);

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Título é obrigatório.'); return; }
    setError('');
    setLoading(true);
    try {
      const due = dueDate ? `${dueDate}T23:59:00.000Z` : undefined;
      const est = estMinutes ? parseInt(estMinutes, 10) : undefined;
      await onSubmit({
        title: title.trim(), difficulty, priority, requiresProof,
        ...(est ? { estimatedMinutes: est } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(due ? { dueDate: due } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar tarefa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.formSheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}</Text>

              {isCompleted && (
                <View style={styles.warnBox}>
                  <Text style={styles.warnText}>Tarefas concluídas não podem ser editadas.</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Título</Text>
              <TextInput
                style={styles.input} value={title} onChangeText={setTitle} editable={!isCompleted}
                placeholder="Ex: Implementar login com OAuth" placeholderTextColor={COLORS.textMuted}
              />

              <Text style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>Descrição (opcional)</Text>
              <TextInput
                style={[styles.input, { height: 72 }]} value={description} onChangeText={setDescription}
                editable={!isCompleted} multiline placeholder="Descreva o que precisa ser feito..." placeholderTextColor={COLORS.textMuted}
              />

              <View style={styles.rowFields}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Dificuldade</Text>
                  <Dropdown
                    value={difficulty}
                    options={DIFFICULTY_OPTIONS.filter((o): o is { value: TaskDifficulty; label: string } => o.value !== 'all')}
                    onChange={setDifficulty}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Prioridade</Text>
                  <Dropdown value={priority} options={PRIORITY_OPTIONS} onChange={setPriority} />
                </View>
              </View>

              <View style={styles.rowFields}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Prazo</Text>
                  <TextInput
                    style={styles.input} value={dueDate} onChangeText={setDueDate} editable={!isCompleted}
                    placeholder="AAAA-MM-DD" placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Tempo estimado (min)</Text>
                  <TextInput
                    style={styles.input} value={estMinutes} onChangeText={setEstMinutes} editable={!isCompleted}
                    keyboardType="number-pad" placeholder="Ex: 60" placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>

              <View style={styles.proofRow}>
                <Text style={styles.fieldLabel}>Exige comprovação fotográfica para concluir</Text>
                <Switch
                  value={requiresProof}
                  onValueChange={setRequiresProof}
                  disabled={isCompleted}
                  trackColor={{ false: COLORS.border, true: COLORS.primary400 }}
                  thumbColor={requiresProof ? COLORS.primary : '#fff'}
                />
              </View>

              <View style={styles.ptsPreview}>
                <Text style={styles.ptsText}>
                  Esta tarefa vale <Text style={{ fontWeight: '700' }}>{pts} pontos</Text>
                </Text>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.formBtnRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                  <Text style={styles.secondaryBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { flex: 1 }, (loading || isCompleted) && { opacity: 0.6 }]}
                  onPress={() => void handleSubmit()}
                  disabled={loading || isCompleted}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.btnText}>{isEdit ? 'Salvar alterações' : 'Criar Tarefa'}</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tela principal — espelha TasksPage.tsx no web
// ---------------------------------------------------------------------------

/** Tela de gerenciamento de tarefas com sugestões, filtros, ordenação e edição */
export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { isWide } = useResponsive();
  const { tasks, isLoading, fetchTasks, createTask, updateTask, deleteTask, completeTask } = useTaskStore();

  const [activeStatus,     setActiveStatus]     = useState<StatusFilter>('all');
  const [activeDifficulty, setActiveDifficulty] = useState<DifficultyFilter>('all');
  const [sortBy,           setSortBy]           = useState<SortBy>('createdAt');
  const [showCreate,       setShowCreate]       = useState(false);
  const [editingTask,      setEditingTask]      = useState<Task | null>(null);
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
    try { await completeTask(id); } catch { /* erros silenciados — UI já reverteu */ }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Excluir tarefa?', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void deleteTask(id) },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingLeft: isWide ? SIDEBAR_WIDTH : 0 }]}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Minhas Tarefas</Text>
          <Text style={styles.headerCount}>{tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'} no total</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.newBtnText}>+ Nova Tarefa</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Sugestões */}
            {suggestions.length > 0 && showSuggestions && (
              <View style={styles.suggestBox}>
                <View style={styles.suggestHeader}>
                  <View style={styles.suggestHeaderLeft}>
                    <Ionicons name="sparkles" size={14} color={COLORS.primary} />
                    <Text style={styles.suggestTitle}>Sugeridas para você</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowSuggestions(false)}>
                    <Text style={styles.suggestClose}>Fechar</Text>
                  </TouchableOpacity>
                </View>
                {suggestions.map(({ task, reason }) => (
                  <View key={task.id} style={styles.suggestRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestTaskTitle} numberOfLines={1}>{task.title}</Text>
                      <Text style={styles.suggestReason} numberOfLines={1}>{reason}</Text>
                    </View>
                    <TouchableOpacity style={styles.suggestViewBtn} onPress={() => setEditingTask(task)}>
                      <Text style={styles.suggestViewBtnText}>Ver</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Abas de status */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
              {STATUS_TABS.map((tab) => {
                const count = tab.value === 'all' ? tasks.length : tasks.filter((t) => t.status === tab.value).length;
                const active = activeStatus === tab.value;
                return (
                  <TouchableOpacity
                    key={tab.value}
                    style={[styles.tab, active && styles.tabActive]}
                    onPress={() => setActiveStatus(tab.value)}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {tab.label} {count}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Dropdowns de filtro/ordenação */}
            <View style={styles.filterRow}>
              <Dropdown value={activeDifficulty} options={DIFFICULTY_OPTIONS} onChange={setActiveDifficulty} style={{ flex: 1 }} />
              <Dropdown value={sortBy} options={SORT_OPTIONS} onChange={setSortBy} style={{ flex: 1 }} />
            </View>

            {isLoading && (
              <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            onComplete={(id) => void handleComplete(id)}
            onDelete={handleDelete}
            onEdit={(t) => setEditingTask(t)}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.center}>
              <Ionicons name="clipboard-outline" size={40} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Nenhuma tarefa encontrada</Text>
              <Text style={styles.emptyHint}>
                {activeStatus !== 'all' ? 'Tente outro filtro ou crie' : 'Crie'} sua primeira tarefa!
              </Text>
            </View>
          ) : null
        }
      />

      {showCreate && (
        <TaskFormModal
          task={null}
          onClose={() => setShowCreate(false)}
          onSubmit={async (data) => { await createTask(data); }}
        />
      )}
      {editingTask && (
        <TaskFormModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSubmit={async (data) => { await updateTask(editingTask.id, data); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.sm,
  },
  headerTitle: { fontSize: FONT.xl, fontWeight: '800', color: COLORS.text },
  headerCount: { fontSize: FONT.sm, color: COLORS.textMuted, marginTop: 2 },
  newBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10 },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT.sm },

  list: { paddingHorizontal: SPACING.md, paddingBottom: 40 },

  suggestBox: {
    backgroundColor: COLORS.primaryDim, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.primary100,
    padding: SPACING.md, marginBottom: SPACING.md, gap: SPACING.sm,
  },
  suggestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  suggestHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  suggestTitle: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary },
  suggestClose: { fontSize: 11, color: COLORS.primary400 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.sm },
  suggestTaskTitle: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.text },
  suggestReason: { fontSize: 11, color: COLORS.textMuted },
  suggestViewBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  suggestViewBtnText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  tabsScroll: { gap: SPACING.xs, paddingBottom: SPACING.sm },
  tab: { paddingHorizontal: SPACING.sm, paddingVertical: 7, borderRadius: RADIUS.md, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },

  filterRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xl, gap: SPACING.xs },
  emptyText: { fontSize: FONT.md, fontWeight: '600', color: COLORS.textSecondary },
  emptyHint: { fontSize: FONT.sm, color: COLORS.textMuted },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.lg },
  formSheet: { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '85%', ...CARD_SHADOW },
  modalTitle: { fontSize: FONT.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  warnBox: { backgroundColor: COLORS.amberDim, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md },
  warnText: { fontSize: 12, color: '#b45309' },
  fieldLabel: { fontSize: FONT.sm, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 4 },
  input: { backgroundColor: COLORS.input, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.inputBorder, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: FONT.base, color: COLORS.text },
  rowFields: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  proofRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md, gap: SPACING.sm },
  ptsPreview: { backgroundColor: COLORS.primaryDim, borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.md },
  ptsText: { fontSize: 12, color: COLORS.primary },
  error: { color: COLORS.red, fontSize: FONT.sm, marginTop: SPACING.sm },
  formBtnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: FONT.base, fontWeight: '600', color: COLORS.textSecondary },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FONT.base },
});
