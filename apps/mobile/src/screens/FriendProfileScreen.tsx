import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getFriendStats, type FriendStats } from '../services/friend.service';
import { getFriendlyErrorMessage } from '../lib/errors';
import StatisticsContent from '../components/StatisticsContent';
import InlineFeedback from '../components/InlineFeedback';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';
import type { AppStackParamList } from '../navigation/index';

interface Props {
  route:      { params: AppStackParamList['FriendProfile'] };
  navigation: { goBack: () => void; navigate: (screen: 'Chat', params: { userId: string; username: string }) => void };
}

/** Perfil de um amigo — mesmas estatísticas da tela própria, com dados do amigo (espelha /amigos/:id no web) */
export default function FriendProfileScreen({ route, navigation }: Props) {
  const { userId, username } = route.params;
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useStyles();

  const [data,    setData]    = useState<FriendStats | null>(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getFriendStats(userId)
      .then(setData)
      .catch((err: unknown) => setError(getFriendlyErrorMessage(err, 'Erro ao carregar o perfil do amigo.')))
      .finally(() => setLoading(false));
  }, [userId]);

  const user = data?.usuario;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.avatar}>
          {user?.avatarUrl
            ? <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
            : <Text style={styles.avatarLetter}>{(user?.username ?? username).charAt(0).toUpperCase()}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{user?.username ?? username}</Text>
          {data && (
            <Text style={styles.headerSub}>
              Nível {data.usuario.level} · #{data.estatisticas.rankPosition} no ranking
            </Text>
          )}
        </View>
        {data && (
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => navigation.navigate('Chat', { userId, username: data.usuario.username })}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
            <Text style={styles.chatBtnText}>Conversar</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : error || !data ? (
        <View style={styles.scroll}>
          <InlineFeedback variant="error" message={error || 'Perfil indisponível.'} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <StatisticsContent stats={data.estatisticas} />
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, paddingBottom: SPACING.sm,
  },
  avatar: { width: 40, height: 40, borderRadius: RADIUS.lg, backgroundColor: colors.primary100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarLetter: { fontSize: FONT.md, fontWeight: '700', color: colors.primary },
  headerTitle: { fontSize: FONT.lg, fontWeight: '800', color: colors.text },
  headerSub:   { fontSize: FONT.sm, color: colors.textMuted, marginTop: 1 },
  chatBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 8 },
  chatBtnText: { color: '#fff', fontSize: FONT.sm, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.sm },
}));
