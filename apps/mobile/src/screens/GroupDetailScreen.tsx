import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Pressable, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MemberRole, TaskDifficulty, type Task } from '@prodscore/shared';
import {
  getGroupDetail, getGroupMembers, getGroupRanking, getGroupMissions,
  type GroupDetails, type GroupMember, type GroupRankingRow,
} from '../services/group.service';
import { createGroupMission, type MissionWithParticipation } from '../services/mission.service';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import RankingItem, { type RankingRow } from '../components/RankingItem';
import TaskItem from '../components/TaskItem';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import type { AppStackParamList } from '../navigation/index';

type Tab = 'membros' | 'ranking' | 'missoes' | 'tarefas';

const ROLE_LABELS: Record<MemberRole, string> = {
  [MemberRole.Owner]:  'Dono',
  [MemberRole.Admin]:  'Admin',
  [MemberRole.Member]: 'Membro',
};

interface Props {
  route:      { params: AppStackParamList['GroupDetail'] };
  navigation: { goBack: () => void; navigate: (screen: 'GroupSettings', params: { groupId: string }) => void };
}

/** Tela de detalhe do grupo — espelha /grupos/:id no web (membros, ranking, missões, tarefas) */
export default function GroupDetailScreen({ route, navigation }: Props) {
  const { groupId, groupName } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { createTask, completeTask, deleteTask } = useTaskStore();

  const [group,    setGroup]    = useState<GroupDetails | null>(null);
  const [members,  setMembers]  = useState<GroupMember[]>([]);
  const [ranking,  setRanking]  = useState<GroupRankingRow[]>([]);
  const [missions, setMissions] = useState<MissionWithParticipation[]>([]);
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [tab,      setTab]      = useState<Tab>('membros');
  const [loading,  setLoading]  = useState(true);
  const [copied,   setCopied]   = useState(false);
  const [showMissionForm, setShowMissionForm] = useState(false);
  const [showTaskForm,    setShowTaskForm]    = useState(false);

  const load = async () => {
    setLoading(true);
    const [detailRes, memsRes, rankRes, missRes, tasksRes] = await Promise.allSettled([
      getGroupDetail(groupId),
      getGroupMembers(groupId),
      getGroupRanking(groupId),
      getGroupMissions(groupId),
      api.get<{ tarefas: Task[] }>('/tasks', { params: { groupId } }),
    ]);
    if (detailRes.status === 'fulfilled') setGroup(detailRes.value);
    if (memsRes.status   === 'fulfilled') setMembers(memsRes.value);
    if (rankRes.status   === 'fulfilled') setRanking(rankRes.value);
    if (missRes.status   === 'fulfilled') setMissions(missRes.value);
    if (tasksRes.status  === 'fulfilled') setTasks(tasksRes.value.data.tarefas);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [groupId]);

  const myRole  = group?.role;
  const isAdmin = myRole === MemberRole.Owner || myRole === MemberRole.Admin;

  const copyInvite = async () => {
    if (!group?.inviteCode) return;
    await Clipboard.setStringAsync(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rankingRows: RankingRow[] = ranking.map((r) => ({
    position: r.position, userId: r.userId, username: r.username, avatarUrl: r.avatarUrl,
    level: r.level, score: r.score, currentStreak: r.currentStreak,
  }));

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'membros', label: 'Membros', count: members.length },
    { key: 'ranking', label: 'Ranking' },
    { key: 'missoes', label: 'Missões', count: missions.length },
    { key: 'tarefas', label: 'Tarefas', count: tasks.length },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{group?.name ?? groupName}</Text>
          {group && (
            <Text style={styles.headerSub}>
              {group.memberCount} {group.memberCount === 1 ? 'membro' : 'membros'}
              {group.activeMissionCount > 0 ? ` · ${group.activeMissionCount} missões ativas` : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('GroupSettings', { groupId })}
          hitSlop={12}
          style={styles.settingsBtn}
        >
          <Ionicons name="settings-outline" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : !group ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Não foi possível carregar o grupo.</Text>
        </View>
      ) : (
        <>
          {/* Código de convite */}
          {group.inviteCode && (
            <TouchableOpacity style={styles.inviteRow} onPress={() => void copyInvite()}>
              <Text style={styles.inviteCode}>{group.inviteCode}</Text>
              <View style={styles.inviteCopy}>
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? '#059669' : COLORS.textMuted} />
                <Text style={[styles.inviteCopyText, copied && { color: '#059669' }]}>
                  {copied ? 'Copiado!' : 'Copiar código'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Abas */}
          <View style={styles.tabRow}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setTab(t.key)}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {t.label}{t.count !== undefined && t.count > 0 ? ` ${t.count}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Conteúdo */}
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {tab === 'membros' && (
              members.length === 0
                ? <Text style={styles.emptyText}>Nenhum membro encontrado.</Text>
                : members.map((m) => {
                  const isMe = m.userId === user?.id;
                  return (
                    <View key={m.userId} style={[styles.memberRow, isMe && styles.memberRowMe]}>
                      <View style={[styles.avatar, isMe && styles.avatarMe]}>
                        <Text style={[styles.avatarLetter, isMe && { color: COLORS.primary }]}>
                          {m.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.memberName, isMe && { color: COLORS.primary }]} numberOfLines={1}>
                          {m.username}{isMe ? ' (você)' : ''}
                        </Text>
                        <Text style={styles.memberMeta}>🔥 {m.currentStreak} dias · Nível {m.level}</Text>
                      </View>
                      <Text style={styles.memberPts}>{m.totalPoints.toLocaleString('pt-BR')} pts</Text>
                      <View style={styles.roleBadge}>
                        <Text style={styles.roleBadgeText}>{ROLE_LABELS[m.role]}</Text>
                      </View>
                    </View>
                  );
                })
            )}

            {tab === 'ranking' && (
              rankingRows.length === 0
                ? <Text style={styles.emptyText}>Nenhum dado de ranking ainda.</Text>
                : (
                  <View style={styles.rankingCard}>
                    {rankingRows.map((row) => (
                      <RankingItem key={row.userId} row={row} isCurrentUser={row.userId === user?.id} />
                    ))}
                  </View>
                )
            )}

            {tab === 'missoes' && (
              <>
                {isAdmin && (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setShowMissionForm(true)}
                  >
                    <Ionicons name="add" size={16} color={COLORS.primary} />
                    <Text style={styles.addBtnText}>Criar missão coletiva</Text>
                  </TouchableOpacity>
                )}
                {missions.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma missão ativa neste grupo.</Text>
                ) : missions.map((m) => {
                  const pct = m.targetValue > 0 ? Math.min((m.currentValue / m.targetValue) * 100, 100) : 0;
                  return (
                    <View key={m.id} style={[styles.missionCard, m.isCompleted && styles.missionCardDone]}>
                      <View style={styles.missionHeader}>
                        <Text style={[styles.missionTitle, m.isCompleted && { color: '#4d7c0f' }]} numberOfLines={1}>
                          {m.isCompleted ? '✓ ' : ''}{m.title}
                        </Text>
                        <View style={styles.missionPtsBadge}>
                          <Text style={styles.missionPtsText}>+{m.rewardPoints} pts</Text>
                        </View>
                      </View>
                      {m.description ? <Text style={styles.missionDesc} numberOfLines={2}>{m.description}</Text> : null}
                      <View style={styles.missionProgressRow}>
                        <Text style={styles.missionProgressLabel}>{m.isCompleted ? 'Concluída!' : 'Progresso do grupo'}</Text>
                        <Text style={styles.missionProgressValue}>{m.currentValue}/{m.targetValue}</Text>
                      </View>
                      <View style={styles.missionTrack}>
                        <View style={[styles.missionFill, { width: `${pct}%` }, m.isCompleted && { backgroundColor: COLORS.lime }]} />
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {tab === 'tarefas' && (
              <>
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowTaskForm(true)}>
                  <Ionicons name="add" size={16} color={COLORS.primary} />
                  <Text style={styles.addBtnText}>Adicionar tarefa ao grupo</Text>
                </TouchableOpacity>
                {tasks.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma tarefa neste grupo ainda.</Text>
                ) : tasks.map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    onComplete={(id) => {
                      void completeTask(id).then(() => void load()).catch(() => {
                        Alert.alert('Erro', 'Não foi possível concluir a tarefa.');
                      });
                    }}
                    onDelete={(id) => {
                      void deleteTask(id).then(() => setTasks((prev) => prev.filter((x) => x.id !== id)));
                    }}
                  />
                ))}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* Modal: criar missão */}
      <Modal visible={showMissionForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={() => setShowMissionForm(false)}>
          <Pressable style={styles.sheet}>
            <CreateMissionForm
              onCancel={() => setShowMissionForm(false)}
              onSave={async (data) => {
                const created = await createGroupMission(groupId, data);
                setMissions((prev) => [{ ...created, isParticipating: true, joinedAt: null }, ...prev]);
                setShowMissionForm(false);
              }}
            />
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: criar tarefa do grupo */}
      <Modal visible={showTaskForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={() => setShowTaskForm(false)}>
          <Pressable style={styles.sheet}>
            <CreateGroupTaskForm
              onCancel={() => setShowTaskForm(false)}
              onSave={async (title) => {
                await createTask({ title, difficulty: TaskDifficulty.Medium, groupId });
                setShowTaskForm(false);
                void load();
              }}
            />
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Formulário: nova missão
// ---------------------------------------------------------------------------

function CreateMissionForm({ onSave, onCancel }: {
  onSave: (data: { title: string; description: string; targetValue: number; rewardPoints: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title,  setTitle]  = useState('');
  const [target, setTarget] = useState('10');
  const [reward, setReward] = useState('50');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    if (!title.trim()) { setError('Título é obrigatório.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ title: title.trim(), description: '', targetValue: Number(target) || 1, rewardPoints: Number(reward) || 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar missão.');
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.handle} />
      <Text style={styles.modalTitle}>Nova missão coletiva</Text>
      <Text style={styles.fieldLabel}>Título</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Completar 20 tarefas juntos" placeholderTextColor={COLORS.textMuted} autoFocus />
      <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Meta</Text>
          <TextInput style={styles.input} value={target} onChangeText={setTarget} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Recompensa (pts)</Text>
          <TextInput style={styles.input} value={reward} onChangeText={setReward} keyboardType="number-pad" />
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} onPress={() => void handleSave()} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Criar missão</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel} style={{ marginTop: SPACING.sm, alignItems: 'center' }}>
        <Text style={styles.cancelText}>Cancelar</Text>
      </TouchableOpacity>
    </>
  );
}

// ---------------------------------------------------------------------------
// Formulário: nova tarefa do grupo
// ---------------------------------------------------------------------------

function CreateGroupTaskForm({ onSave, onCancel }: { onSave: (title: string) => Promise<void>; onCancel: () => void }) {
  const [title,  setTitle]  = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try { await onSave(title.trim()); } finally { setSaving(false); }
  };

  return (
    <>
      <View style={styles.handle} />
      <Text style={styles.modalTitle}>Nova tarefa do grupo</Text>
      <Text style={styles.fieldLabel}>Título</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Revisar documentação" placeholderTextColor={COLORS.textMuted} autoFocus />
      <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} onPress={() => void handleSave()} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Criar tarefa</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel} style={{ marginTop: SPACING.sm, alignItems: 'center' }}>
        <Text style={styles.cancelText}>Cancelar</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md },
  headerTitle: { fontSize: FONT.lg, fontWeight: '800', color: COLORS.text },
  headerSub:   { fontSize: FONT.sm, color: COLORS.textMuted, marginTop: 1 },
  settingsBtn: { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: FONT.base, textAlign: 'center', paddingVertical: SPACING.lg },

  inviteRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  inviteCode: { fontSize: FONT.md, fontWeight: '800', letterSpacing: 3, color: COLORS.primary },
  inviteCopy: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inviteCopyText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },

  tabRow: { flexDirection: 'row', gap: 4, marginHorizontal: SPACING.md, marginBottom: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: '#fff' },

  content: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.sm },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderSoft,
    padding: SPACING.sm, ...CARD_SHADOW,
  },
  memberRowMe: { borderColor: COLORS.primary100, backgroundColor: COLORS.primaryDim },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.borderSoft, alignItems: 'center', justifyContent: 'center' },
  avatarMe: { backgroundColor: COLORS.primary100 },
  avatarLetter: { fontWeight: '700', color: COLORS.textSecondary },
  memberName: { fontSize: FONT.base, fontWeight: '600', color: COLORS.text },
  memberMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  memberPts: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  roleBadge: { backgroundColor: COLORS.borderSoft, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  roleBadgeText: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },

  rankingCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderSoft, overflow: 'hidden' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.primary400, borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm, marginBottom: SPACING.sm,
  },
  addBtnText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.primary },

  missionCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderSoft, padding: SPACING.md, gap: 6, ...CARD_SHADOW },
  missionCardDone: { backgroundColor: COLORS.limeDim, borderColor: 'rgba(163,230,53,0.4)' },
  missionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  missionTitle: { flex: 1, fontSize: FONT.base, fontWeight: '600', color: COLORS.text },
  missionPtsBadge: { backgroundColor: COLORS.amberDim, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  missionPtsText: { fontSize: 11, fontWeight: '700', color: '#b45309' },
  missionDesc: { fontSize: 12, color: COLORS.textMuted },
  missionProgressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  missionProgressLabel: { fontSize: 11, color: COLORS.textMuted },
  missionProgressValue: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  missionTrack: { height: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.borderSoft, overflow: 'hidden' },
  missionFill: { height: '100%', borderRadius: RADIUS.sm, backgroundColor: COLORS.primary },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.xs },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.sm },
  modalTitle: { fontSize: FONT.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  fieldLabel: { fontSize: FONT.sm, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 4 },
  input: { backgroundColor: COLORS.input, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.inputBorder, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: FONT.base, color: COLORS.text },
  error: { color: COLORS.red, fontSize: FONT.sm, marginTop: SPACING.xs },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.md },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FONT.md },
  cancelText: { color: COLORS.textMuted, fontSize: FONT.sm, fontWeight: '600' },
});
