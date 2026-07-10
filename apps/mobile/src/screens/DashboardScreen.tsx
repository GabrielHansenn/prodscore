import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TaskStatus, type Task } from '@prodscore/shared';
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import { useUserStore } from '../store/userStore';
import StatCard  from '../components/StatCard';
import LevelBar  from '../components/LevelBar';
import TaskItem  from '../components/TaskItem';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

/** Painel principal com resumo de produtividade e gamificação */
export default function DashboardScreen() {
  const insets  = useSafeAreaInsets();
  const { user }                      = useAuthStore();
  const { stats, fetchStats }         = useUserStore();
  const { tasks, fetchTasks, completeTask, deleteTask } = useTaskStore();

  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(null);
  const [toast,             setToast]             = useState('');

  useEffect(() => {
    void fetchStats();
    void fetchTasks();
  }, []);

  // Filtra tarefas de hoje (pendentes/em andamento com vencimento hoje)
  const today  = new Date().toISOString().split('T')[0]!;
  const todayTasks = tasks.filter((t) => {
    if (t.status === TaskStatus.Completed) return false;
    if (!t.dueDate) return false;
    return t.dueDate.startsWith(today);
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleComplete = async (id: string) => {
    try {
      const result = await completeTask(id);
      showToast(`+${result.pontosGanhos} pontos ganhos!`);
      if (result.marcoStreak) setCelebrationStreak(result.novoStreak);
      void fetchStats(); // atualiza pontos e streak
    } catch {
      showToast('Erro ao concluir tarefa.');
    }
  };

  const handleDelete = (id: string) => {
    void deleteTask(id);
  };

  const firstName = user?.username.split('_')[0] ?? 'Jogador';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Saudação */}
        <View style={styles.greeting}>
          <Text style={styles.greetTitle}>Olá, {firstName}! 👋</Text>
          <Text style={styles.greetSub}>Vamos ser produtivos hoje?</Text>
        </View>

        {/* Linha de stat cards */}
        {stats ? (
          <View style={styles.statsRow}>
            <StatCard label="Pontos"    value={stats.totalPoints.toLocaleString('pt-BR')} accent="emerald" icon="⭐" />
            <StatCard label="Sequência" value={`🔥 ${stats.currentStreak}`}               accent="amber"   />
            <StatCard label="Nível"     value={stats.level}                               accent="violet"  icon="⚡" />
            <StatCard label="Hoje"      value={stats.tasksCompletedThisWeek}              accent="blue"    icon="✓"  />
          </View>
        ) : (
          <View style={styles.statsRow}>
            {['Pontos','Sequência','Nível','Hoje'].map((l) => (
              <View key={l} style={[styles.statPlaceholder]}>
                <Text style={styles.placeholderText}>{l}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Barra de nível */}
        {stats && (
          <View style={styles.section}>
            <LevelBar level={stats.level} totalPoints={stats.totalPoints} />
          </View>
        )}

        {/* Tarefas de hoje */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tarefas para Hoje</Text>
          {todayTasks.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhuma tarefa para hoje 🎉</Text>
            </View>
          ) : (
            <FlatList
              data={todayTasks}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => (
                <TaskItem
                  task={item}
                  onComplete={(id) => void handleComplete(id)}
                  onDelete={handleDelete}
                />
              )}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Missões ativas */}
        {stats && stats.activeMissions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Missões Ativas</Text>
            {stats.activeMissions.map((m) => {
              const pct = m.targetValue > 0
                ? Math.min((m.currentValue / m.targetValue) * 100, 100)
                : 0;
              return (
                <View key={m.id} style={styles.missionCard}>
                  <View style={styles.missionHeader}>
                    <Text style={styles.missionTitle} numberOfLines={1}>{m.title}</Text>
                    <Text style={styles.missionPts}>+{m.rewardPoints} pts</Text>
                  </View>
                  <View style={styles.progressMeta}>
                    <Text style={styles.progressText}>{m.currentValue}/{m.targetValue}</Text>
                    <Text style={styles.progressText}>{Math.round(pct)}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* Toast de pontos */}
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* Modal de celebração de streak */}
      <Modal visible={celebrationStreak !== null} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setCelebrationStreak(null)}>
          <View style={styles.celebrationCard}>
            <Text style={styles.celebrationEmoji}>🔥</Text>
            <Text style={styles.celebrationTitle}>Sequência de {celebrationStreak} dias!</Text>
            <Text style={styles.celebrationSub}>Incrível! Continue assim!</Text>
            <TouchableOpacity
              style={styles.celebrationBtn}
              onPress={() => setCelebrationStreak(null)}
            >
              <Text style={styles.celebrationBtnText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  greeting: { marginBottom: SPACING.lg },
  greetTitle: { fontSize: FONT.xxl, fontWeight: '800', color: COLORS.text },
  greetSub:   { fontSize: FONT.base, color: COLORS.textMuted, marginTop: SPACING.xs },

  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statPlaceholder: {
    flex:            1,
    height:          80,
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  placeholderText: { fontSize: FONT.sm, color: COLORS.textMuted },

  section:      { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },

  empty:     { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyText: { fontSize: FONT.base, color: COLORS.textMuted },

  missionCard: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    gap:             SPACING.sm,
  },
  missionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  missionTitle:  { flex: 1, fontSize: FONT.base, fontWeight: '600', color: COLORS.text },
  missionPts:    { fontSize: FONT.sm, fontWeight: '700', color: COLORS.amber },
  progressMeta:  { flexDirection: 'row', justifyContent: 'space-between' },
  progressText:  { fontSize: FONT.sm, color: COLORS.textMuted },
  progressTrack: { height: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.border, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: RADIUS.sm, backgroundColor: COLORS.emerald },

  toast: {
    position:        'absolute',
    bottom:          80,
    left:            SPACING.lg,
    right:           SPACING.lg,
    backgroundColor: 'rgba(52,211,153,0.15)',
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.emerald,
    padding:         SPACING.md,
    alignItems:      'center',
  },
  toastText: { color: COLORS.emerald, fontWeight: '600', fontSize: FONT.base },

  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         SPACING.lg,
  },
  celebrationCard: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.xl,
    borderWidth:     1,
    borderColor:     COLORS.amber,
    padding:         SPACING.xl,
    alignItems:      'center',
    width:           '100%',
    gap:             SPACING.sm,
  },
  celebrationEmoji: { fontSize: 56 },
  celebrationTitle: { fontSize: FONT.xl, fontWeight: '800', color: COLORS.amber, textAlign: 'center' },
  celebrationSub:   { fontSize: FONT.base, color: COLORS.textSecondary, textAlign: 'center' },
  celebrationBtn:   { backgroundColor: COLORS.amber, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: SPACING.xl, marginTop: SPACING.sm },
  celebrationBtnText: { color: COLORS.background, fontWeight: '700', fontSize: FONT.md },
});
