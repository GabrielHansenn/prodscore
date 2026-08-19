import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import RankingItem, { type RankingRow } from '../components/RankingItem';
import { api } from '../services/api';
import { useResponsive, SIDEBAR_WIDTH } from '../lib/useResponsive';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

type Tab = 'global' | 'semanal';

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

// ---------------------------------------------------------------------------
// Tela de ranking
// ---------------------------------------------------------------------------

/** Tela de placar de líderes com abas Global e Semanal */
export default function RankingScreen() {
  const insets   = useSafeAreaInsets();
  const { isWide } = useResponsive();
  const { user }              = useAuthStore();
  const { stats, fetchStats } = useUserStore();

  const [tab,      setTab]      = useState<Tab>('global');
  const [rows,     setRows]     = useState<RankingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => { void fetchStats(); }, []);

  useEffect(() => {
    setIsLoading(true);
    setError('');
    void (async () => {
      try {
        const data = tab === 'global'
          ? await fetchGlobalRanking()
          : await fetchWeeklyRanking();
        setRows(data);
      } catch {
        setError('Não foi possível carregar o ranking.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [tab]);

  const myRow = rows.find((r) => r.userId === user?.id);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await api.post('/ranking/refresh');
      setRows(await fetchGlobalRanking());
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
        {tab === 'global' && (
          <TouchableOpacity style={styles.refreshBtn} onPress={() => void handleRefresh()} disabled={isRefreshing}>
            {isRefreshing
              ? <ActivityIndicator size="small" color={COLORS.textSecondary} />
              : <Ionicons name="refresh" size={14} color={COLORS.textSecondary} />}
            <Text style={styles.refreshText}>{isRefreshing ? 'Atualizando…' : 'Atualizar'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Posição do usuário — espelha o card "Sua posição no ranking global" da RankingPage web */}
      {summary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Sua posição no ranking global</Text>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryPosition}>#{summary.position > 0 ? summary.position : '—'}</Text>
              <Text style={styles.summarySub}>Posição geral</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View>
              <Text style={styles.summaryValue}>{summary.points.toLocaleString('pt-BR')}</Text>
              <Text style={styles.summarySub}>Pontos totais</Text>
            </View>
            <View>
              <View style={styles.summaryStreakRow}>
                <Ionicons name="flame" size={16} color={COLORS.amber} />
                <Text style={[styles.summaryValue, { color: COLORS.amber }]}>{summary.streak}</Text>
              </View>
              <Text style={styles.summarySub}>Sequência atual</Text>
            </View>
            <View>
              <Text style={[styles.summaryValue, { color: COLORS.primary }]}>Nível {summary.level}</Text>
              <Text style={styles.summarySub}>Nível atual</Text>
            </View>
          </View>
        </View>
      )}

      {/* Segmento Global / Semanal */}
      <View style={styles.segmentRow}>
        {(['global', 'semanal'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.segment, tab === t && styles.segmentActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
              {t === 'global' ? 'Global' : 'Semanal'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
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

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.md, paddingBottom: SPACING.sm },
  // flex:1 + minWidth:0 dá uma largura travada pro bloco de texto, senão o
  // subtítulo longo não quebra linha e empurra o botão pra fora da tela
  headerText:  { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: FONT.xl, fontWeight: '800', color: COLORS.text },
  headerSub:   { fontSize: FONT.sm, color: COLORS.textMuted, marginTop: 2 },

  refreshBtn: {
    flexShrink:      0,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    borderWidth:     1,
    borderColor:     COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  refreshText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },

  summaryCard: {
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.md,
    backgroundColor:  COLORS.primaryDim,
    borderRadius:     RADIUS.lg,
    borderWidth:      1,
    borderColor:      'rgba(124,58,237,0.2)',
    padding:          SPACING.md,
  },
  summaryLabel: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.primaryDark },
  summaryRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    alignItems: 'center', gap: SPACING.lg, marginTop: SPACING.sm,
  },
  summaryPosition: { fontSize: FONT.xxl, fontWeight: '800', color: COLORS.primaryDark },
  summaryValue:    { fontSize: FONT.lg, fontWeight: '800', color: COLORS.text },
  summarySub:      { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  summaryDivider:  { width: 1, height: 32, backgroundColor: COLORS.border },
  summaryStreakRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  segmentRow: {
    flexDirection:   'row',
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.md,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.border,
    backgroundColor: COLORS.card,
    padding:         4,
    gap:             4,
  },
  segment:           { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center' },
  segmentActive:     { backgroundColor: COLORS.primary },
  segmentText:       { fontSize: FONT.base, fontWeight: '600', color: COLORS.textMuted },
  segmentTextActive: { color: '#ffffff' },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  errorText: { color: COLORS.red, fontSize: FONT.base, textAlign: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: FONT.base },
});
