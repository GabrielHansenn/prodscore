import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TaskStatus, type Task, type PointTransaction, type LevelReward } from '@prodscore/shared';
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import { useUserStore } from '../store/userStore';
import { api } from '../services/api';
import StatCard  from '../components/StatCard';
import LevelBar  from '../components/LevelBar';
import TaskItem  from '../components/TaskItem';
import StreakBadge from '../components/StreakBadge';
import PointTransactionFeed from '../components/PointTransactionFeed';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { useResponsive, SIDEBAR_WIDTH } from '../lib/useResponsive';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';

const LEVEL_BADGE_EMOJI: Record<string, string> = {
  rocket: '🚀', star: '⭐', diamond: '💎', crown: '👑', legend: '🏆',
};

/** Painel principal com resumo de produtividade e gamificação */
export default function DashboardScreen() {
  const insets  = useSafeAreaInsets();
  const { isWide } = useResponsive();
  const { user }                      = useAuthStore();
  const { stats, fetchStats }         = useUserStore();
  const { tasks, fetchTasks, completeTask, deleteTask } = useTaskStore();

  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(null);
  const [levelReward,       setLevelReward]       = useState<LevelReward | null>(null);
  const [toast,             setToast]             = useState('');
  const [transactions,      setTransactions]      = useState<PointTransaction[]>([]);

  useEffect(() => {
    void fetchStats();
    void fetchTasks();
    void loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const { data } = await api.get<{ transacoes: PointTransaction[] }>('/users/me/transactions', { params: { limite: 5 } });
      setTransactions(data.transacoes);
    } catch {
      // opcional — feed fica vazio
    }
  };

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
      showToast(`Tarefa concluída! +${result.pontosGanhos} pts`);
      if (result.marcoStreak)     setCelebrationStreak(result.novoStreak);
      if (result.recompensaNivel) setLevelReward(result.recompensaNivel);
      void fetchStats(); // atualiza pontos e streak
      void loadTransactions();
    } catch {
      showToast('Erro ao concluir tarefa.');
    }
  };

  const handleDelete = (id: string) => {
    void deleteTask(id);
  };

  const firstName = user?.username.split('_')[0] ?? 'Jogador';

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingLeft: isWide ? SIDEBAR_WIDTH : 0 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <ResponsiveContainer>

        {/* Saudação */}
        <View style={styles.greeting}>
          <Text style={styles.greetTitle}>Olá, {firstName}!</Text>
          <Text style={styles.greetSub}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </Text>
        </View>

        {/* Linha de stat cards — 2x2 em telas estreitas, 1x4 em telas largas
            (espelha grid-cols-2 lg:grid-cols-4 do DashboardPage web) */}
        {stats ? (
          <View style={[styles.statsRow, !isWide && styles.statsRowWrap]}>
            <View style={isWide ? styles.statCell : styles.statCellHalf}>
              <StatCard
                label="Pontos" value={stats.totalPoints.toLocaleString('pt-BR')} accent="primary"
                sub={`#${stats.rankPosition > 0 ? stats.rankPosition : '–'} no ranking`}
              />
            </View>
            <View style={isWide ? styles.statCell : styles.statCellHalf}>
              <StatCard
                label="Sequência" value={stats.currentStreak} accent="amber"
                sub={stats.currentStreak === 1 ? 'dia consecutivo' : 'dias consecutivos'}
              />
            </View>
            <View style={isWide ? styles.statCell : styles.statCellHalf}>
              <StatCard
                label="Nível" value={stats.level} accent="lime"
                sub={`${stats.achievementsCount} conquistas`}
              />
            </View>
            <View style={isWide ? styles.statCell : styles.statCellHalf}>
              <StatCard
                label="Esta Semana" value={stats.tasksCompletedThisWeek} accent="blue"
                sub={`${stats.pointsThisWeek} pts esta semana`}
              />
            </View>
          </View>
        ) : (
          <View style={[styles.statsRow, !isWide && styles.statsRowWrap]}>
            {['Pontos','Sequência','Nível','Esta Semana'].map((l) => (
              <View key={l} style={[styles.statPlaceholder, !isWide && styles.statCellHalf]}>
                <Text style={styles.placeholderText}>{l}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Barra de nível */}
        {stats && (
          <View style={[styles.section, styles.levelCard]}>
            <LevelBar level={stats.level} totalPoints={stats.totalPoints} />
          </View>
        )}

        {/* Tarefas de hoje */}
        <View style={styles.section}>
          <View style={styles.taskCard}>
            <View style={styles.taskCardHeader}>
              <Text style={styles.taskCardTitle}>Tarefas de Hoje</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{todayTasks.length}</Text>
              </View>
            </View>
            {todayTasks.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Nenhuma tarefa para hoje!</Text>
                <Text style={styles.emptyHint}>Que tal criar uma nova?</Text>
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
        </View>

        {/* Sequência + últimas transações */}
        {user && (
          <View style={[styles.section, { gap: SPACING.sm }]}>
            <StreakBadge
              currentStreak={user.currentStreak}
              longestStreak={user.longestStreak}
              streakFreezes={user.streakFreezes}
            />
            <View style={styles.txCard}>
              <Text style={styles.txCardTitle}>Últimas transações</Text>
              <PointTransactionFeed transactions={transactions} />
            </View>
          </View>
        )}

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

      </ResponsiveContainer>
      </ScrollView>

      {/* Toast de pontos */}
      {toast ? (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.lime} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* Modal de recompensa de nível */}
      <Modal visible={levelReward !== null} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setLevelReward(null)}>
          <View style={styles.celebrationCard}>
            <Text style={styles.celebrationEmoji}>
              {LEVEL_BADGE_EMOJI[levelReward?.badgeKey ?? ''] ?? '🎁'}
            </Text>
            <Text style={[styles.celebrationTitle, { color: COLORS.primary }]}>
              Nível {levelReward?.level} atingido!
            </Text>
            <Text style={styles.celebrationSub}>{levelReward?.description}</Text>
            <View style={styles.rewardPillsRow}>
              {!!levelReward?.bonusPoints && (
                <View style={styles.rewardPill}><Text style={styles.rewardPillText}>+{levelReward.bonusPoints} pts</Text></View>
              )}
              {!!levelReward?.bonusFreezes && (
                <View style={[styles.rewardPill, { backgroundColor: COLORS.blueDim }]}>
                  <Text style={[styles.rewardPillText, { color: '#1d4ed8' }]}>+{levelReward.bonusFreezes} 🧊</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.celebrationBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => setLevelReward(null)}
            >
              <Text style={styles.celebrationBtnText}>Incrível!</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Modal de celebração de streak */}
      <Modal visible={celebrationStreak !== null} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setCelebrationStreak(null)}>
          <View style={styles.celebrationCard}>
            <Text style={styles.celebrationEmoji}>🔥</Text>
            <Text style={styles.celebrationTitle}>Sequência de {celebrationStreak} dias!</Text>
            <Text style={styles.celebrationSub}>Incrível! Continue assim!</Text>
            <Text style={styles.celebrationBonus}>+50 pontos bônus!</Text>
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

  statsRow:     { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statsRowWrap: { flexWrap: 'wrap' },
  statCell:     { flex: 1 },
  statCellHalf: { width: '48%' },
  statPlaceholder: {
    flex:            1,
    height:          80,
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.borderSoft,
    alignItems:      'center',
    justifyContent:  'center',
    ...CARD_SHADOW,
  },
  placeholderText: { fontSize: FONT.sm, color: COLORS.textMuted },

  section:      { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  levelCard: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.borderSoft,
    padding:         SPACING.md,
    ...CARD_SHADOW,
  },

  taskCard: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.borderSoft,
    padding:         SPACING.md,
    ...CARD_SHADOW,
  },
  taskCardHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   SPACING.md,
  },
  taskCardTitle: { fontSize: FONT.base, fontWeight: '700', color: COLORS.text },
  countPill: {
    backgroundColor: COLORS.borderSoft,
    borderRadius:    RADIUS.xl,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  countPillText: { fontSize: FONT.sm, color: COLORS.textSecondary },

  empty:     { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyText: { fontSize: FONT.base, color: COLORS.textMuted },
  emptyHint: { fontSize: FONT.sm, color: COLORS.textMuted, marginTop: 2 },

  txCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderSoft,
    padding: SPACING.md, ...CARD_SHADOW,
  },
  txCardTitle: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.textSecondary, marginBottom: SPACING.sm },

  missionCard: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.borderSoft,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    gap:             SPACING.sm,
    ...CARD_SHADOW,
  },
  missionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  missionTitle:  { flex: 1, fontSize: FONT.base, fontWeight: '600', color: COLORS.text },
  missionPts:    { fontSize: FONT.sm, fontWeight: '700', color: COLORS.amber },
  progressMeta:  { flexDirection: 'row', justifyContent: 'space-between' },
  progressText:  { fontSize: FONT.sm, color: COLORS.textMuted },
  progressTrack: { height: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.border, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: RADIUS.sm, backgroundColor: COLORS.primary },

  toast: {
    position:        'absolute',
    bottom:          80,
    left:            SPACING.lg,
    right:           SPACING.lg,
    flexDirection:   'row',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.primary100,
    padding:         SPACING.md,
    alignItems:      'center',
    gap:             SPACING.sm,
    ...CARD_SHADOW,
  },
  toastText: { color: COLORS.text, fontWeight: '600', fontSize: FONT.base },

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
    borderColor:     'rgba(245,158,11,0.35)',
    padding:         SPACING.xl,
    alignItems:      'center',
    width:           '100%',
    gap:             SPACING.sm,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.2,
    shadowRadius:    24,
    elevation:       10,
  },
  celebrationEmoji: { fontSize: 56 },
  celebrationTitle: { fontSize: FONT.xl, fontWeight: '800', color: COLORS.amber, textAlign: 'center' },
  celebrationSub:   { fontSize: FONT.base, color: COLORS.textSecondary, textAlign: 'center' },
  celebrationBonus: { fontSize: FONT.sm, fontWeight: '600', color: '#65a30d' },
  rewardPillsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  rewardPill: { backgroundColor: COLORS.primaryDim, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  rewardPillText: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary },
  celebrationBtn:   { backgroundColor: COLORS.amber, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: SPACING.xl, marginTop: SPACING.sm },
  celebrationBtnText: { color: '#ffffff', fontWeight: '700', fontSize: FONT.md },
});
