import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TaskDifficulty, TaskStatus, type Task, type TaskSuggestion } from '@prodscore/shared';
import { useTaskStore } from '../store/taskStore';
import { getTaskSuggestions } from '../services/behavioral.service';
import { getFriendlyErrorMessage } from '../lib/errors';
import { refreshStatsAndShowXpGain } from '../lib/xpGain';
import { showToast } from '../store/toastStore';
import TaskItem from '../components/TaskItem';
import Dropdown from '../components/Dropdown';
import TaskFormModal, { BASE_POINTS } from '../components/TaskFormModal';
import { useResponsive, SIDEBAR_WIDTH } from '../lib/useResponsive';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

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

// ---------------------------------------------------------------------------
// Tela principal — espelha TasksPage.tsx no web
// ---------------------------------------------------------------------------

/** Tela de gerenciamento de tarefas com sugestões, filtros, ordenação e edição */
export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { isWide } = useResponsive();
  const { tasks, isLoading, fetchTasks, createTask, updateTask, deleteTask, completeTask } = useTaskStore();
  const colors = useThemeColors();
  const styles = useStyles();

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
    try {
      const result = await completeTask(id);
      void refreshStatsAndShowXpGain(result);
    } catch (err) {
      showToast(getFriendlyErrorMessage(err, 'Não foi possível concluir a tarefa.'), 'error');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Excluir tarefa?', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: () => {
          void deleteTask(id).catch((err: unknown) => {
            showToast(getFriendlyErrorMessage(err, 'Não foi possível excluir a tarefa.'), 'error');
          });
        },
      },
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
                    <Ionicons name="sparkles" size={14} color={colors.primary} />
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
              <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
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
              <Ionicons name="clipboard-outline" size={40} color={colors.textMuted} />
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

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.sm,
  },
  headerTitle: { fontSize: FONT.xl, fontWeight: '800', color: colors.text },
  headerCount: { fontSize: FONT.sm, color: colors.textMuted, marginTop: 2 },
  newBtn: { backgroundColor: colors.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10 },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT.sm },

  list: { paddingHorizontal: SPACING.md, paddingBottom: 40 },

  suggestBox: {
    backgroundColor: colors.primaryDim, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.primary100,
    padding: SPACING.md, marginBottom: SPACING.md, gap: SPACING.sm,
  },
  suggestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  suggestHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  suggestTitle: { fontSize: FONT.sm, fontWeight: '700', color: colors.primary },
  suggestClose: { fontSize: 11, color: colors.primary400 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: colors.card, borderRadius: RADIUS.md, padding: SPACING.sm },
  suggestTaskTitle: { fontSize: FONT.sm, fontWeight: '600', color: colors.text },
  suggestReason: { fontSize: 11, color: colors.textMuted },
  suggestViewBtn: { backgroundColor: colors.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  suggestViewBtnText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  tabsScroll: { gap: SPACING.xs, paddingBottom: SPACING.sm },
  tab: { paddingHorizontal: SPACING.sm, paddingVertical: 7, borderRadius: RADIUS.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: '#fff' },

  filterRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xl, gap: SPACING.xs },
  emptyText: { fontSize: FONT.md, fontWeight: '600', color: colors.textSecondary },
  emptyHint: { fontSize: FONT.sm, color: colors.textMuted },
}));
