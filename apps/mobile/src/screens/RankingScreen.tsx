import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { AppStackParamList } from '../navigation/index';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import RankingItem, { type RankingRow } from '../components/RankingItem';
import { api } from '../services/api';
import { useResponsive, SIDEBAR_WIDTH } from '../lib/useResponsive';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

type Tab = 'global' | 'semanal' | 'amigos';

const TAB_LABELS: Record<Tab, string> = { global: 'Global', semanal: 'Semanal', amigos: 'Amigos' };

// ---------------------------------------------------------------------------
// Funções de busca de ranking (inline, sem reutilizar o serviço do web)
// ---------------------------------------------------------------------------

async function fetchGlobalRanking(): Promise<RankingRow[]> {
  const { data } = await api.get<{ ranking: Array<{
    position: number;
    usuario:  { id: string; username: string; avatarUrl: string | null; level: number };
    score:    number;
    currentStreak: number;
  }> }>('/ranking/global', { params: { limite: 50 } });

  return data.ranking.map((r) => ({
    position:      r.position,
    userId:        r.usuario.id,
    username:      r.usuario.username,
    avatarUrl:     r.usuario.avatarUrl,
    level:         r.usuario.level,
    score:         r.score,
    currentStreak: r.currentStreak,
  }));
}

async function fetchWeeklyRanking(): Promise<RankingRow[]> {
  const { data } = await api.get<{ ranking: Array<{
    position:       number;
    usuario:        { id: string; username: string; avatarUrl: string | null; level: number };
    pontosNaSemana: number;
    currentStreak:  number;
  }> }>('/ranking/weekly', { params: { limite: 50 } });

  return data.ranking.map((r) => ({
    position:      r.position,
    userId:        r.usuario.id,
    username:      r.usuario.username,
    avatarUrl:     r.usuario.avatarUrl,
    level:         r.usuario.level,
    score:         r.pontosNaSemana,
    currentStreak: r.currentStreak,
  }));
}

/** Empates dividem a posição; quem ainda não entrou na view vem no fim com pending. */
async function fetchFriendsRanking(): Promise<{ rows: RankingRow[]; totalAmigos: number }> {
  const { data } = await api.get<{
    ranking: Array<{
      position:      number | null;
      usuario:       { id: string; username: string; avatarUrl: string | null; level: number };
      score:         number | null;
      currentStreak: number;
    }>;
    totalAmigos: number;
  }>('/ranking/friends');

  return {
    totalAmigos: data.totalAmigos,
    rows: data.ranking.map((r) => ({
      position:      r.position ?? 0,
      userId:        r.usuario.id,
      username:      r.usuario.username,
      avatarUrl:     r.usuario.avatarUrl,
      level:         r.usuario.level,
      score:         r.score ?? 0,
      currentStreak: r.currentStreak,
      pending:       r.position === null,
    })),
  };
}

async function fetchTab(tab: Tab): Promise<{ rows: RankingRow[]; totalAmigos: number | null }> {
  if (tab === 'amigos') return fetchFriendsRanking();
  const rows = tab === 'global' ? await fetchGlobalRanking() : await fetchWeeklyRanking();
  return { rows, totalAmigos: null };
}

// ---------------------------------------------------------------------------
// Tela de ranking
// ---------------------------------------------------------------------------

/** Tela de placar de líderes com abas Global, Semanal e Amigos */
export default function RankingScreen() {
  const insets   = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { isWide } = useResponsive();
  const { user }              = useAuthStore();
  const { stats, fetchStats } = useUserStore();
  const colors = useThemeColors();
  const styles = useStyles();

  const [tab,      setTab]      = useState<Tab>('global');
  const [rows,     setRows]     = useState<RankingRow[]>([]);
  const [totalAmigos, setTotalAmigos] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => { void fetchStats(); }, []);

  useEffect(() => {
    setIsLoading(true);
    setError('');
    setRows([]);
    void (async () => {
      try {
        const data = await fetchTab(tab);
        setRows(data.rows);
        setTotalAmigos(data.totalAmigos);
      } catch {
        setError('Não foi possível carregar o ranking.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [tab]);

  const myRow = rows.find((r) => r.userId === user?.id);
  const isFriendsTab = tab === 'amigos';
  const hasNoFriends = isFriendsTab && totalAmigos === 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await api.post('/ranking/refresh');
      const data = await fetchTab(tab);
      setRows(data.rows);
      setTotalAmigos(data.totalAmigos);
    } catch {
      setError('Não foi possível atualizar o ranking.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fonte principal: /users/me/stats (igual à web). Se essa chamada falhar,
  // usa os dados já carregados na própria lista de ranking como fallback —
  // assim o card não some por completo quando só o endpoint de stats falha.
  const summary = stats
    ? { position: stats.rankPosition, points: stats.totalPoints, streak: stats.currentStreak, level: stats.level }
    : (tab === 'global' && myRow)
      ? { position: myRow.position, points: myRow.score, streak: myRow.currentStreak, level: myRow.level }
      : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingLeft: isWide ? SIDEBAR_WIDTH : 0 }]}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Ranking</Text>
          <Text style={styles.headerSub}>Compare sua produtividade com outros jogadores</Text>
        </View>
        {tab !== 'semanal' && (
          <TouchableOpacity style={styles.refreshBtn} onPress={() => void handleRefresh()} disabled={isRefreshing}>
            {isRefreshing
              ? <ActivityIndicator size="small" color={colors.textSecondary} />
              : <Ionicons name="refresh" size={14} color={colors.textSecondary} />}
            <Text style={styles.refreshText}>{isRefreshing ? 'Atualizando…' : 'Atualizar'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Posição do usuário — espelha o card "Sua posição no ranking global" da RankingPage web */}
      {summary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            {isFriendsTab ? 'Sua posição entre amigos' : 'Sua posição no ranking global'}
          </Text>
          <View style={styles.summaryRow}>
            {isFriendsTab ? (
              <View>
                <Text style={styles.summaryPosition}>#{myRow && !myRow.pending ? myRow.position : '—'}</Text>
                <Text style={styles.summarySub}>
                  {isLoading ? 'Entre amigos' : `de ${rows.length} ${rows.length === 1 ? 'jogador' : 'jogadores'}`}
                </Text>
              </View>
            ) : (
              <View>
                <Text style={styles.summaryPosition}>#{summary.position > 0 ? summary.position : '—'}</Text>
                <Text style={styles.summarySub}>Posição geral</Text>
              </View>
            )}
            <View style={styles.summaryDivider} />
            <View>
              <Text style={styles.summaryValue}>{summary.points.toLocaleString('pt-BR')}</Text>
              <Text style={styles.summarySub}>Pontos totais</Text>
            </View>
            <View>
              <View style={styles.summaryStreakRow}>
                <Ionicons name="flame" size={16} color={colors.amber} />
                <Text style={[styles.summaryValue, { color: colors.amber }]}>{summary.streak}</Text>
              </View>
              <Text style={styles.summarySub}>Sequência atual</Text>
            </View>
            <View>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>Nível {summary.level}</Text>
              <Text style={styles.summarySub}>Nível atual</Text>
            </View>
          </View>
        </View>
      )}

      {/* Segmento Global / Semanal / Amigos */}
      <View style={styles.segmentRow}>
        {(['global', 'semanal', 'amigos'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.segment, tab === t && styles.segmentActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
              {TAB_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : hasNoFriends ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="people" size={24} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Você ainda não tem amigos para competir</Text>
          <Text style={styles.emptyBody}>
            Adicione amigos para ver quem está mais produtivo e disputar as primeiras posições.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Friends')}>
            <Text style={styles.emptyBtnText}>Adicionar amigos</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.userId}
          renderItem={({ item }) => (
            <RankingItem row={item} isCurrentUser={item.userId === user?.id} />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Nenhum dado de ranking ainda.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.md, paddingBottom: SPACING.sm },
  // flex:1 + minWidth:0 dá uma largura travada pro bloco de texto, senão o
  // subtítulo longo não quebra linha e empurra o botão pra fora da tela
  headerText:  { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: FONT.xl, fontWeight: '800', color: colors.text },
  headerSub:   { fontSize: FONT.sm, color: colors.textMuted, marginTop: 2 },

  refreshBtn: {
    flexShrink:      0,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    borderWidth:     1,
    borderColor:     colors.border,
    backgroundColor: colors.card,
    borderRadius:    RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  refreshText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },

  summaryCard: {
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.md,
    backgroundColor:  colors.primaryDim,
    borderRadius:     RADIUS.lg,
    borderWidth:      1,
    borderColor:      'rgba(124,58,237,0.2)',
    padding:          SPACING.md,
  },
  summaryLabel: { fontSize: FONT.sm, fontWeight: '600', color: colors.primaryDark },
  summaryRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    alignItems: 'center', gap: SPACING.lg, marginTop: SPACING.sm,
  },
  summaryPosition: { fontSize: FONT.xxl, fontWeight: '800', color: colors.primaryDark },
  summaryValue:    { fontSize: FONT.lg, fontWeight: '800', color: colors.text },
  summarySub:      { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  summaryDivider:  { width: 1, height: 32, backgroundColor: colors.border },
  summaryStreakRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  segmentRow: {
    flexDirection:   'row',
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.md,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     colors.border,
    backgroundColor: colors.card,
    padding:         4,
    gap:             4,
  },
  segment:           { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center' },
  segmentActive:     { backgroundColor: colors.primary },
  segmentText:       { fontSize: FONT.base, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#ffffff' },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  errorText: { color: colors.red, fontSize: FONT.base, textAlign: 'center' },
  emptyText: { color: colors.textMuted, fontSize: FONT.base },
  emptyIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryDim, marginBottom: SPACING.sm,
  },
  emptyTitle: { fontSize: FONT.base, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyBody:  { fontSize: FONT.sm, color: colors.textMuted, textAlign: 'center', marginTop: 4, maxWidth: 320 },
  emptyBtn: {
    marginTop: SPACING.md, backgroundColor: colors.primary,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10,
  },
  emptyBtnText: { color: '#ffffff', fontWeight: '600', fontSize: FONT.base },
}));
