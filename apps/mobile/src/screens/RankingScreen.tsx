import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import RankingItem, { type RankingRow } from '../components/RankingItem';
import { api } from '../services/api';
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
  const { user }              = useAuthStore();
  const { stats, fetchStats } = useUserStore();

  const [tab,      setTab]      = useState<Tab>('global');
  const [rows,     setRows]     = useState<RankingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ranking</Text>
        {stats && (
          <Text style={styles.myPosition}>
            Sua posição: <Text style={{ color: COLORS.emerald, fontWeight: '700' }}>
              #{stats.rankPosition > 0 ? stats.rankPosition : '—'}
            </Text>
          </Text>
        )}
      </View>

      {/* Banner da posição do usuário */}
      {myRow && (
        <View style={styles.myBanner}>
          <Text style={styles.myBannerText}>
            🏆 Você está em <Text style={{ color: COLORS.emerald }}>#{myRow.position}</Text> com{' '}
            <Text style={{ color: COLORS.emerald }}>{myRow.score.toLocaleString('pt-BR')}</Text>{' '}
            {tab === 'semanal' ? 'pontos esta semana' : 'pontos'}
          </Text>
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
          <ActivityIndicator color={COLORS.emerald} size="large" />
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', padding: SPACING.md },
  headerTitle: { fontSize: FONT.xl, fontWeight: '800', color: COLORS.text },
  myPosition:  { fontSize: FONT.base, color: COLORS.textSecondary },

  myBanner: {
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.sm,
    backgroundColor:  COLORS.emeraldDim,
    borderRadius:     RADIUS.md,
    borderWidth:      1,
    borderColor:      'rgba(52,211,153,0.25)',
    padding:          SPACING.md,
  },
  myBannerText: { fontSize: FONT.sm, color: COLORS.textSecondary, lineHeight: 18 },

  segmentRow: {
    flexDirection:   'row',
    marginHorizontal: SPACING.md,
    marginBottom:     SPACING.md,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.border,
    backgroundColor: COLORS.card,
    overflow:        'hidden',
  },
  segment:           { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentActive:     { backgroundColor: COLORS.border },
  segmentText:       { fontSize: FONT.base, fontWeight: '600', color: COLORS.textMuted },
  segmentTextActive: { color: COLORS.text },

  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  errorText: { color: COLORS.red, fontSize: FONT.base, textAlign: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: FONT.base },
});
