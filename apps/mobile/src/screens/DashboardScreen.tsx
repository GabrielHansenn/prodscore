import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, Modal, Pressable, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TaskStatus, isLocalToday, type Task, type PointTransaction, type LevelReward } from '@prodscore/shared';
import { showToast } from '../store/toastStore';
import { getFriendlyErrorMessage } from '../lib/errors';
import { confirmTaskDeletion } from '../lib/confirmTaskDeletion';
import { usePullToRefresh } from '../lib/usePullToRefresh';
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import { useUserStore } from '../store/userStore';
import { refreshStatsAndShowXpGain } from '../lib/xpGain';
import { api } from '../services/api';
import StatCard  from '../components/StatCard';
import LevelBar  from '../components/LevelBar';
import TaskItem  from '../components/TaskItem';
import StreakBadge from '../components/StreakBadge';
import PointTransactionFeed from '../components/PointTransactionFeed';
import WeeklyGoalCard from '../components/WeeklyGoalCard';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { useResponsive, SIDEBAR_WIDTH } from '../lib/useResponsive';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import NotificationBell from '../components/NotificationBell';
import { HelpHeaderButton } from '../components/HelpButton';
import FriendsShortcut from '../components/FriendsShortcut';
import ProcrastinationAlerts from '../components/ProcrastinationAlerts';
import ErrorState from '../components/ErrorState';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

const LEVEL_BADGE_EMOJI: Record<string, string> = {
  rocket: '🚀', star: '⭐', diamond: '💎', crown: '👑', legend: '🏆',
};

/** Painel principal com resumo de produtividade e gamificação */
export default function DashboardScreen() {
  const insets  = useSafeAreaInsets();
  const { isWide } = useResponsive();
  const { user }                      = useAuthStore();
  const { stats, loadError: statsError, fetchStats } = useUserStore();
  const { tasks, loadError: tasksError, fetchTasks, completeTask, deleteTask } = useTaskStore();
  const colors = useThemeColors();
  const styles = useStyles();

  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(null);
  const [levelReward,       setLevelReward]       = useState<LevelReward | null>(null);
  const [transactions,      setTransactions]      = useState<PointTransaction[]>([]);

  const loadAll = () => Promise.all([fetchStats(), fetchTasks(), loadTransactions()]);
  const { refreshing, onRefresh } = usePullToRefresh(loadAll);

  useEffect(() => {
    void loadAll();
  }, []);

  const loadTransactions = async () => {
    try {
      const { data } = await api.get<{ transacoes: PointTransaction[] }>('/users/me/transactions', { params: { limite: 5 } });
      setTransactions(data.transacoes);
    } catch {
      // opcional — feed fica vazio
    }
  };

  // Tarefas de hoje (pendentes/em andamento com vencimento hoje) — "hoje" no
  // fuso do aparelho; antes usava o dia em UTC, que depois das 21h já é amanhã
  const todayTasks = tasks.filter((t) => {
    if (t.status === TaskStatus.Completed) return false;
    if (!t.dueDate) return false;
    return isLocalToday(t.dueDate);
  });

  const handleComplete = async (id: string) => {
    try {
      const result = await completeTask(id);
      void refreshStatsAndShowXpGain(result);
      if (result.marcoStreak)     setCelebrationStreak(result.novoStreak);
      if (result.recompensaNivel) setLevelReward(result.recompensaNivel);
      void loadTransactions();
    } catch (err) {
      showToast(getFriendlyErrorMessage(err, 'Não foi possível concluir a tarefa.'), 'error');
    }
  };

  // Mesma confirmação das telas Tarefas e Grupo (antes excluía direto)
  const handleDelete = (id: string) => confirmTaskDeletion(() => deleteTask(id));

  const firstName = user?.username.split('_')[0] ?? 'Jogador';

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingLeft: isWide ? SIDEBAR_WIDTH : 0 }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
      <ResponsiveContainer>

        {/* Saudação + sino de notificações */}
        <View style={styles.greeting}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetTitle}>Olá, {firstName}!</Text>
            <Text style={styles.greetSub}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </Text>
          </View>
          {/* Amigos ao lado do sino: no app ficava escondido no menu do Perfil */}
          <View style={styles.headerActions}>
            <FriendsShortcut />
            <HelpHeaderButton />
            <NotificationBell />
          </View>
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
        ) : statsError ? (
          // Antes os placeholders ficavam na tela para sempre quando a API falhava
          <ErrorState message={statsError} onRetry={fetchStats} />
        ) : (
          <View style={[styles.statsRow, !isWide && styles.statsRowWrap]}>
            {['Pontos','Sequência','Nível','Esta Semana'].map((l) => (
              <View key={l} style={[styles.statPlaceholder, !isWide && styles.statCellHalf]}>
                <Text style={styles.placeholderText}>{l}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Alertas de procrastinação — o web já tinha, o app não */}
        <ProcrastinationAlerts />

        {/* Barra de nível */}
        {stats && (
          <View style={[styles.section, styles.levelCard]}>
            <LevelBar level={stats.level} totalPoints={stats.totalPoints} />
          </View>
        )}

        {/* Meta da semana — gamificação adaptativa (recarrega quando os pontos mudam) */}
        <WeeklyGoalCard {...(stats ? { refreshKey: stats.totalPoints } : {})} />

        {/* Tarefas de hoje */}
        <View style={styles.section}>
          <View style={styles.taskCard}>
            <View style={styles.taskCardHeader}>
              <Text style={styles.taskCardTitle}>Tarefas de Hoje</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{todayTasks.length}</Text>
              </View>
            </View>
            {tasksError && tasks.length === 0 ? (
              <ErrorState message={tasksError} onRetry={fetchTasks} />
            ) : todayTasks.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Nenhuma tarefa com prazo para hoje.</Text>
                <Text style={styles.emptyHint}>Tarefas sem prazo ficam na aba Tarefas.</Text>
              </View>
            ) : (
              <FlatList
                data={todayTasks}
                keyExtractor={(t) => t.id}
                renderItem={({ item }) => (
                  <TaskItem
                    task={item}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                  />
                )}
                scrollEnabled={false}
              />
            )}
          </View>
        </View>

        {/* Sequência + últimas transações */}
        {stats && (
          <View style={[styles.section, { gap: SPACING.sm }]}>
            <StreakBadge
              currentStreak={stats.currentStreak}
              longestStreak={stats.longestStreak}
              streakFreezes={stats.streakFreezes}
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

      {/* Modal de recompensa de nível */}
      <Modal visible={levelReward !== null} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setLevelReward(null)}>
          <View style={styles.celebrationCard}>
            <Text style={styles.celebrationEmoji}>
              {LEVEL_BADGE_EMOJI[levelReward?.badgeKey ?? ''] ?? '🎁'}
            </Text>
            <Text style={[styles.celebrationTitle, { color: colors.primary }]}>
              Nível {levelReward?.level} atingido!
            </Text>
            <Text style={styles.celebrationSub}>{levelReward?.description}</Text>
            <View style={styles.rewardPillsRow}>
              {!!levelReward?.bonusPoints && (
                <View style={styles.rewardPill}><Text style={styles.rewardPillText}>+{levelReward.bonusPoints} pts</Text></View>
              )}
              {!!levelReward?.bonusFreezes && (
                <View style={[styles.rewardPill, { backgroundColor: colors.blueDim }]}>
                  <Ionicons name="snow" size={12} color="#1d4ed8" />
                  <Text style={[styles.rewardPillText, { color: '#1d4ed8' }]}>+{levelReward.bonusFreezes}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.celebrationBtn, { backgroundColor: colors.primary }]}
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

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  headerActions: { flexDirection: 'row', gap: SPACING.sm },
  greetTitle: { fontSize: FONT.xxl, fontWeight: '800', color: colors.text },
  greetSub:   { fontSize: FONT.base, color: colors.textMuted, marginTop: SPACING.xs },

  statsRow:     { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statsRowWrap: { flexWrap: 'wrap' },
  statCell:     { flex: 1 },
  statCellHalf: { width: '48%' },
  statPlaceholder: {
    flex:            1,
    height:          80,
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     colors.borderSoft,
    alignItems:      'center',
    justifyContent:  'center',
    ...CARD_SHADOW,
  },
  placeholderText: { fontSize: FONT.sm, color: colors.textMuted },

  section:      { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT.lg, fontWeight: '700', color: colors.text, marginBottom: SPACING.md },
  levelCard: {
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     colors.borderSoft,
    padding:         SPACING.md,
    ...CARD_SHADOW,
  },

  taskCard: {
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     colors.borderSoft,
    padding:         SPACING.md,
    ...CARD_SHADOW,
  },
  taskCardHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   SPACING.md,
  },
  taskCardTitle: { fontSize: FONT.base, fontWeight: '700', color: colors.text },
  countPill: {
    backgroundColor: colors.borderSoft,
    borderRadius:    RADIUS.xl,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  countPillText: { fontSize: FONT.sm, color: colors.textSecondary },

  empty:     { alignItems: 'center', paddingVertical: SPACING.xl },
  emptyText: { fontSize: FONT.base, color: colors.textMuted },
  emptyHint: { fontSize: FONT.sm, color: colors.textMuted, marginTop: 2 },

  txCard: {
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: SPACING.md, ...CARD_SHADOW,
  },
  txCardTitle: { fontSize: FONT.sm, fontWeight: '700', color: colors.textSecondary, marginBottom: SPACING.sm },

  missionCard: {
    backgroundColor: colors.card,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     colors.borderSoft,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    gap:             SPACING.sm,
    ...CARD_SHADOW,
  },
  missionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  missionTitle:  { flex: 1, fontSize: FONT.base, fontWeight: '600', color: colors.text },
  missionPts:    { fontSize: FONT.sm, fontWeight: '700', color: colors.amber },
  progressMeta:  { flexDirection: 'row', justifyContent: 'space-between' },
  progressText:  { fontSize: FONT.sm, color: colors.textMuted },
  progressTrack: { height: 6, borderRadius: RADIUS.sm, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: RADIUS.sm, backgroundColor: colors.primary },

  overlay: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         SPACING.lg,
  },
  celebrationCard: {
    backgroundColor: colors.card,
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
  celebrationTitle: { fontSize: FONT.xl, fontWeight: '800', color: colors.amber, textAlign: 'center' },
  celebrationSub:   { fontSize: FONT.base, color: colors.textSecondary, textAlign: 'center' },
  celebrationBonus: { fontSize: FONT.sm, fontWeight: '600', color: '#65a30d' },
  rewardPillsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  rewardPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryDim, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  rewardPillText: { fontSize: FONT.sm, fontWeight: '700', color: colors.primary },
  celebrationBtn:   { backgroundColor: colors.amber, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: SPACING.xl, marginTop: SPACING.sm },
  celebrationBtnText: { color: '#ffffff', fontWeight: '700', fontSize: FONT.md },
}));
