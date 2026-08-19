import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BehavioralProfileType, type BehavioralProfile, type BehavioralTag } from '@prodscore/shared';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { getBehavioralProfile } from '../services/behavioral.service';
import AchievementBadge, { type BadgeData } from '../components/AchievementBadge';
import LevelBar from '../components/LevelBar';
import { api } from '../services/api';
import { useResponsive, SIDEBAR_WIDTH } from '../lib/useResponsive';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import type { AppStackParamList } from '../navigation/index';

// ---------------------------------------------------------------------------
// Tipos e constantes locais
// ---------------------------------------------------------------------------

interface PointTransaction {
  id:        string;
  amount:    number;
  reason:    string;
  createdAt: string;
}

const REASON_LABELS: Record<string, string> = {
  task_completed:    'Tarefa concluída',
  streak_bonus:      'Bônus de sequência',
  late_penalty:      'Penalidade por atraso',
  mission_reward:    'Recompensa de missão',
  achievement_bonus: 'Bônus de conquista',
};

const PROFILE_META: Record<BehavioralProfileType, { emoji: string; label: string; description: string }> = {
  [BehavioralProfileType.EarlyBird]: { emoji: '🌅', label: 'Madrugador', description: 'Você é mais produtivo nas primeiras horas da manhã (5h–9h).' },
  [BehavioralProfileType.Morning]:   { emoji: '☀️', label: 'Matutino',   description: 'Seu pico de produtividade é pela manhã (9h–12h).' },
  [BehavioralProfileType.Afternoon]: { emoji: '🌤️', label: 'Vespertino', description: 'Você produz mais durante a tarde (12h–17h).' },
  [BehavioralProfileType.Evening]:   { emoji: '🌆', label: 'Noturno',    description: 'Você está no seu melhor no começo da noite (17h–22h).' },
  [BehavioralProfileType.NightOwl]:  { emoji: '🦉', label: 'Coruja',     description: 'Você é mais produtivo de madrugada ou tarde da noite (22h–5h).' },
  [BehavioralProfileType.Undefined]: { emoji: '🔍', label: 'Indefinido', description: 'Complete mais tarefas para identificar seu perfil de produtividade.' },
};

const TAG_LABELS: Record<BehavioralTag, string> = {
  consistente:    'Consistente',
  procrastinador: 'Procrastinador',
  intenso:        'Intenso',
  metódico:       'Metódico',
  iniciante:      'Iniciante',
};

/** Tela de perfil com stats, edição, perfil comportamental, conquistas e histórico */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { width, isWide } = useResponsive();
  // Espelha "grid-cols-2 sm:grid-cols-3" da ProfilePage web (breakpoint sm=640)
  const statCols = width >= 640 ? 3 : 2;
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user, logout }         = useAuthStore();
  const { stats, fetchStats }    = useUserStore();

  const [badges,     setBadges]     = useState<BadgeData[]>([]);
  const [txs,        setTxs]        = useState<PointTransaction[]>([]);
  const [txLoading,  setTxLoading]  = useState(true);
  const [behavioral, setBehavioral] = useState<BehavioralProfile | null>(null);

  const [editing,  setEditing]  = useState(false);
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio,      setBio]      = useState(user?.bio ?? '');
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    void fetchStats();
    void loadData();
    void getBehavioralProfile().then(setBehavioral).catch(() => { /* opcional */ });
  }, []);

  const loadData = async () => {
    try {
      const [achRes, txRes] = await Promise.all([
        api.get<{ conquistas: Array<{ id: string; name: string; icon: string; rewardPoints: number; earnedAt: string }> }>('/achievements/me'),
        api.get<{ transacoes: PointTransaction[] }>('/users/me/transactions', { params: { limite: 10 } }),
      ]);
      setBadges(achRes.data.conquistas.map((a) => ({
        id: a.id, name: a.name, icon: a.icon, rewardPoints: a.rewardPoints, earnedAt: a.earnedAt,
      })));
      setTxs(txRes.data.transacoes);
    } catch {
      // Silencia — seções ficam vazias
    } finally {
      setTxLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await api.patch('/users/me', { username: username.trim(), bio: bio.trim() || null });
      setSaveMsg({ ok: true, msg: 'Perfil atualizado com sucesso!' });
      setEditing(false);
    } catch (err) {
      setSaveMsg({ ok: false, msg: err instanceof Error ? err.message : 'Erro ao salvar perfil.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  if (!user) return null;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingLeft: isWide ? SIDEBAR_WIDTH : 0 }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header do perfil */}
        <View style={styles.identityCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{user.username.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.username}>{user.username}</Text>
              <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
              {user.bio ? <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text> : null}
            </View>
          </View>

          {stats && (
            <View style={styles.xpSection}>
              <View style={styles.xpHeaderRow}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>Nível {stats.level}</Text>
                </View>
                <Text style={styles.xpTotalText}>{stats.totalPoints.toLocaleString('pt-BR')} pts totais</Text>
              </View>
              <LevelBar level={stats.level} totalPoints={stats.totalPoints} />
            </View>
          )}

          <TouchableOpacity style={styles.editToggleBtn} onPress={() => setEditing((v) => !v)}>
            <Text style={styles.editToggleText}>{editing ? 'Cancelar edição' : 'Editar perfil'}</Text>
          </TouchableOpacity>

          {editing && (
            <View style={styles.editForm}>
              <Text style={styles.fieldLabel}>Nome de usuário</Text>
              <TextInput style={styles.input} value={username} onChangeText={setUsername} maxLength={30} autoCapitalize="none" />
              <Text style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>Bio (opcional)</Text>
              <TextInput
                style={[styles.input, { height: 64 }]} value={bio} onChangeText={setBio}
                multiline maxLength={160} placeholder="Conte um pouco sobre você..." placeholderTextColor={COLORS.textMuted}
              />
              {saveMsg && !saveMsg.ok && <Text style={styles.errorMsg}>{saveMsg.msg}</Text>}
              <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} onPress={() => void handleSaveProfile()} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Salvar alterações</Text>}
              </TouchableOpacity>
            </View>
          )}
          {saveMsg?.ok && !editing && (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>✓ {saveMsg.msg}</Text>
            </View>
          )}
        </View>

        {/* Menu — telas secundárias (espelha itens da sidebar web) */}
        <View style={styles.menuCard}>
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Achievements')}>
            <Ionicons name="trophy-outline" size={18} color={COLORS.amber} />
            <Text style={styles.menuRowText}>Conquistas</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Statistics')}>
            <Ionicons name="stats-chart-outline" size={18} color={COLORS.blue} />
            <Text style={styles.menuRowText}>Estatísticas</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Security')}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.menuRowText}>Segurança</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Estatísticas rápidas — espelha a grade de 6 do web */}
        {stats && (
          <View style={styles.statsGrid}>
            {[
              { label: 'Tarefas Concluídas', value: stats.tasksCompleted,                    color: COLORS.success },
              { label: 'Sequência Atual',    value: `🔥 ${stats.currentStreak}`,              color: COLORS.amber   },
              { label: 'Maior Sequência',    value: `${stats.longestStreak} dias`,            color: COLORS.orange  },
              { label: 'Conquistas',         value: String(stats.achievementsCount),          color: COLORS.amber   },
              { label: 'Consistência',       value: `${Math.round(stats.consistencyRate)}%`,  color: COLORS.blue    },
              { label: 'Pts Esta Semana',    value: stats.pointsThisWeek.toLocaleString('pt-BR'), color: COLORS.primary },
            ].map((s) => (
              <View key={s.label} style={[styles.statCell, { minWidth: statCols === 3 ? '30%' : '47%' }]}>
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Perfil comportamental */}
        {behavioral && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Perfil Comportamental</Text>
            <View style={styles.behaviorCard}>
              <View style={styles.behaviorRow}>
                <View style={styles.behaviorEmojiBox}>
                  <Text style={styles.behaviorEmoji}>{PROFILE_META[behavioral.type].emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.behaviorLabel}>{PROFILE_META[behavioral.type].label}</Text>
                  <Text style={styles.behaviorDesc}>{PROFILE_META[behavioral.type].description}</Text>
                  {behavioral.peakHour !== null && (
                    <Text style={styles.behaviorPeak}>Pico de atividade: {String(behavioral.peakHour).padStart(2, '0')}h</Text>
                  )}
                </View>
              </View>
              {behavioral.tags.length > 0 && (
                <View style={styles.tagRow}>
                  {behavioral.tags.map((t) => (
                    <View key={t} style={styles.tag}>
                      <Text style={styles.tagText}>{TAG_LABELS[t]}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.behaviorFooter}>
                Baseado nas últimas {behavioral.totalAnalyzed} tarefas concluídas
              </Text>
            </View>
          </View>
        )}

        {/* Conquistas em scroll horizontal */}
        {badges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Minhas Conquistas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesRow}>
              {badges.map((b) => (
                <AchievementBadge key={b.id} badge={b} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Atividade recente */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Atividade Recente</Text>
          <View style={styles.card}>
            {txLoading ? (
              <ActivityIndicator color={COLORS.primary} size="small" style={{ padding: SPACING.lg }} />
            ) : txs.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma transação ainda.</Text>
            ) : (
              txs.map((tx, i) => (
                <View key={tx.id} style={[styles.txRow, i < txs.length - 1 && styles.txBorder]}>
                  <View style={styles.txLeft}>
                    <Text style={styles.txLabel}>
                      {REASON_LABELS[tx.reason] ?? tx.reason}
                    </Text>
                    <Text style={styles.txDate}>
                      {new Date(tx.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.amount >= 0 ? COLORS.success : COLORS.red }]}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount} pts
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Botão Sair */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },

  identityCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderSoft,
    padding: SPACING.md, marginBottom: SPACING.md, ...CARD_SHADOW,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatarCircle:  { width: 64, height: 64, borderRadius: RADIUS.xl, backgroundColor: COLORS.primary100, alignItems: 'center', justifyContent: 'center' },
  avatarLetter:  { fontSize: FONT.xxl, fontWeight: '700', color: COLORS.primary },
  profileInfo:   { flex: 1, gap: 2 },
  username:      { fontSize: FONT.xl, fontWeight: '700', color: COLORS.text },
  email:         { fontSize: FONT.sm, color: COLORS.textMuted },
  bio:           { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  xpSection:   { marginTop: SPACING.md },
  xpHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  levelBadge:    { backgroundColor: COLORS.primaryDim, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  levelBadgeText: { fontSize: FONT.sm, fontWeight: '700', color: COLORS.primary },
  xpTotalText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.primary },

  editToggleBtn: { marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center' },
  editToggleText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textSecondary },
  editForm: { marginTop: SPACING.md, gap: 4 },
  fieldLabel: { fontSize: FONT.sm, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 4 },
  input: { backgroundColor: COLORS.input, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.inputBorder, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: FONT.base, color: COLORS.text },
  errorMsg: { color: COLORS.red, fontSize: 12, marginTop: SPACING.xs },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', marginTop: SPACING.sm },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FONT.base },
  successBanner: { marginTop: SPACING.md, backgroundColor: COLORS.successDim, borderRadius: RADIUS.md, padding: SPACING.sm },
  successBannerText: { color: '#047857', fontSize: 12, fontWeight: '600' },

  menuCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderSoft, marginBottom: SPACING.md, overflow: 'hidden', ...CARD_SHADOW },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  menuRowText: { flex: 1, fontSize: FONT.base, fontWeight: '600', color: COLORS.text },
  menuDivider: { height: 1, backgroundColor: COLORS.borderSoft, marginLeft: SPACING.md },

  statsGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SPACING.sm,
    marginBottom:  SPACING.lg,
  },
  statCell: {
    flex:            1,
    minWidth:        '30%',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.borderSoft,
    padding:         SPACING.md,
    ...CARD_SHADOW,
  },
  statValue: { fontSize: FONT.md, fontWeight: '700' },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  section:      { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },

  behaviorCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderSoft, padding: SPACING.md, ...CARD_SHADOW },
  behaviorRow: { flexDirection: 'row', gap: SPACING.md },
  behaviorEmojiBox: { width: 52, height: 52, borderRadius: RADIUS.lg, backgroundColor: COLORS.primaryDim, alignItems: 'center', justifyContent: 'center' },
  behaviorEmoji: { fontSize: 26 },
  behaviorLabel: { fontSize: FONT.base, fontWeight: '700', color: COLORS.text },
  behaviorDesc:  { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  behaviorPeak:  { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  tag: { backgroundColor: COLORS.borderSoft, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  behaviorFooter: { fontSize: 10, color: COLORS.textMuted, marginTop: SPACING.sm },

  badgesRow: { gap: SPACING.md, paddingRight: SPACING.md },

  card:     { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderSoft, overflow: 'hidden', ...CARD_SHADOW },
  txRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md },
  txBorder: { borderBottomWidth: 1, borderColor: COLORS.border },
  txLeft:   { flex: 1, gap: 2 },
  txLabel:  { fontSize: FONT.base, color: COLORS.text, fontWeight: '500' },
  txDate:   { fontSize: FONT.sm, color: COLORS.textMuted },
  txAmount: { fontSize: FONT.base, fontWeight: '700' },
  emptyText: { padding: SPACING.lg, color: COLORS.textMuted, textAlign: 'center' },

  logoutBtn:  { backgroundColor: COLORS.redDim, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', paddingVertical: 14, alignItems: 'center', marginTop: SPACING.sm },
  logoutText: { color: COLORS.red, fontWeight: '700', fontSize: FONT.md },
});
