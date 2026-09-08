import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Switch,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MemberRole, validateRequired } from '@prodscore/shared';
import {
  getGroupDetail, getGroupMembers, updateGroupInfo, regenerateInviteCode,
  updateMemberRole, kickMember, leaveGroup, deleteGroup,
  type GroupDetails, type GroupMember,
} from '../services/group.service';
import { useAuthStore } from '../store/authStore';
import { getFriendlyErrorMessage } from '../lib/errors';
import { showToast } from '../store/toastStore';
import InlineFeedback from '../components/InlineFeedback';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import type { AppStackParamList } from '../navigation/index';

const ROLE_LABELS: Record<MemberRole, string> = {
  [MemberRole.Owner]:  'Dono',
  [MemberRole.Admin]:  'Admin',
  [MemberRole.Member]: 'Membro',
};

interface Props {
  route:      { params: AppStackParamList['GroupSettings'] };
  navigation: { goBack: () => void; navigate: (screen: 'Tabs') => void };
}

/** Tela de configurações do grupo — espelha /grupos/:id/configuracoes no web */
export default function GroupSettingsScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [group,   setGroup]   = useState<GroupDetails | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [countExternal, setCountExternal] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const [detailRes, memsRes] = await Promise.allSettled([
        getGroupDetail(groupId), getGroupMembers(groupId),
      ]);
      if (detailRes.status === 'fulfilled') {
        setGroup(detailRes.value);
        setName(detailRes.value.name);
        setDesc(detailRes.value.description ?? '');
        setCountExternal(detailRes.value.countExternalTasksInMissions);
      }
      if (memsRes.status === 'fulfilled') setMembers(memsRes.value);
      setLoading(false);
    })();
  }, [groupId]);

  const myRole  = group?.role;
  const isOwner = myRole === MemberRole.Owner;
  const isAdmin = isOwner || myRole === MemberRole.Admin;
  const dirty   = !!group && (
    name !== group.name ||
    desc !== (group.description ?? '') ||
    countExternal !== group.countExternalTasksInMissions
  );

  const handleSaveInfo = async () => {
    if (!group || !dirty) return;

    const nameError = validateRequired(name, 'Nome do grupo');
    if (nameError) { setFeedback({ ok: false, msg: nameError }); return; }

    setSaving(true);
    setFeedback(null);
    try {
      const updated = await updateGroupInfo(groupId, {
        name: name.trim(),
        description: desc.trim() || null,
        countExternalTasksInMissions: countExternal,
      });
      setGroup({ ...group, ...updated });
      setFeedback({ ok: true, msg: 'Informações salvas com sucesso.' });
    } catch (err) {
      setFeedback({ ok: false, msg: getFriendlyErrorMessage(err, 'Erro ao salvar.') });
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async () => {
    if (!group?.inviteCode) return;
    await Clipboard.setStringAsync(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    Alert.alert(
      'Gerar novo código?',
      'O código atual deixará de funcionar imediatamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Gerar novo código', style: 'destructive', onPress: () => {
            void (async () => {
              setRegenLoading(true);
              try {
                const code = await regenerateInviteCode(groupId);
                setGroup((g) => g ? { ...g, inviteCode: code } : g);
              } catch (err) {
                showToast(getFriendlyErrorMessage(err, 'Erro ao gerar novo código.'), 'error');
              } finally { setRegenLoading(false); }
            })();
          },
        },
      ],
    );
  };

  const handlePromote = (m: GroupMember, role: 'admin' | 'member') => {
    Alert.alert(
      role === 'admin' ? `Promover ${m.username}?` : `Rebaixar ${m.username}?`,
      role === 'admin' ? `${m.username} poderá gerenciar membros e criar missões.` : `${m.username} perderá privilégios de administrador.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar', onPress: () => {
            void updateMemberRole(groupId, m.userId, role).then(() => {
              setMembers((prev) => prev.map((x) => x.userId === m.userId
                ? { ...x, role: role === 'admin' ? MemberRole.Admin : MemberRole.Member }
                : x));
            }).catch((err: unknown) => showToast(getFriendlyErrorMessage(err, 'Não foi possível concluir a ação.'), 'error'));
          },
        },
      ],
    );
  };

  const handleKick = (m: GroupMember) => {
    Alert.alert(
      `Remover ${m.username}?`,
      `${m.username} será removido do grupo imediatamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive', onPress: () => {
            void kickMember(groupId, m.userId).then(() => {
              setMembers((prev) => prev.filter((x) => x.userId !== m.userId));
            }).catch((err: unknown) => showToast(getFriendlyErrorMessage(err, 'Não foi possível remover o membro.'), 'error'));
          },
        },
      ],
    );
  };

  const handleLeave = () => {
    Alert.alert(
      'Sair do grupo?',
      'Você perderá acesso ao grupo e às missões coletivas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair do grupo', style: 'destructive', onPress: () => {
            void leaveGroup(groupId)
              .then(() => navigation.navigate('Tabs'))
              .catch((err: unknown) => showToast(getFriendlyErrorMessage(err, 'Não foi possível sair do grupo.'), 'error'));
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Excluir grupo?',
      `Esta ação é irreversível. Todos os membros, missões e histórico de "${group?.name}" serão apagados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir definitivamente', style: 'destructive', onPress: () => {
            void deleteGroup(groupId)
              .then(() => navigation.navigate('Tabs'))
              .catch((err: unknown) => showToast(getFriendlyErrorMessage(err, 'Não foi possível excluir o grupo.'), 'error'));
          },
        },
      ],
    );
  };

  const canPromote = (m: GroupMember) => isOwner && m.role === MemberRole.Member && m.userId !== user?.id;
  const canDemote  = (m: GroupMember) => isOwner && m.role === MemberRole.Admin  && m.userId !== user?.id;
  const canKick    = (m: GroupMember) => {
    if (m.role === MemberRole.Owner || m.userId === user?.id || !isAdmin) return false;
    if (myRole === MemberRole.Admin && m.role === MemberRole.Admin) return false;
    return true;
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Configurações</Text>
          {group && <Text style={styles.headerSub}>{group.name}</Text>}
        </View>
      </View>

      {loading || !group ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Informações do grupo */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>INFORMAÇÕES DO GRUPO</Text>
            {isAdmin ? (
              <>
                <Text style={styles.fieldLabel}>Nome</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={100} />
                <Text style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>Descrição</Text>
                <TextInput
                  style={[styles.input, { height: 72 }]} value={desc} onChangeText={setDesc}
                  multiline maxLength={500} placeholder="Opcional" placeholderTextColor={COLORS.textMuted}
                />
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, marginRight: SPACING.sm }}>
                    <Text style={styles.fieldLabel}>Contar tarefas de fora do grupo nas missões</Text>
                    <Text style={styles.switchHint}>
                      Se desativado (padrão), só tarefas criadas dentro deste grupo contam para o
                      progresso das missões em equipe.
                    </Text>
                  </View>
                  <Switch value={countExternal} onValueChange={setCountExternal} />
                </View>
                {feedback && <InlineFeedback variant={feedback.ok ? 'success' : 'error'} message={feedback.msg} />}
                <TouchableOpacity
                  style={[styles.btn, (!dirty || saving) && { opacity: 0.5 }]}
                  onPress={() => void handleSaveInfo()}
                  disabled={!dirty || saving}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Salvar alterações</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.readRow}><Text style={styles.readLabel}>Nome: </Text>{group.name}</Text>
                {group.description ? <Text style={styles.readRow}><Text style={styles.readLabel}>Descrição: </Text>{group.description}</Text> : null}
              </>
            )}
          </View>

          {/* Código de convite */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>CÓDIGO DE CONVITE</Text>
            <View style={styles.codeRow}>
              <View style={styles.codeBox}><Text style={styles.codeText}>{group.inviteCode}</Text></View>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => void copyCode()}>
                <Text style={styles.secondaryBtnText}>{copied ? '✓ Copiado!' : 'Copiar'}</Text>
              </TouchableOpacity>
            </View>
            {isAdmin && (
              <TouchableOpacity style={styles.regenBtn} onPress={handleRegenerate} disabled={regenLoading}>
                <Text style={styles.regenBtnText}>{regenLoading ? 'Gerando…' : 'Gerar novo código'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Membros — admin/owner */}
          {isAdmin && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>MEMBROS ({members.length})</Text>
              {members.map((m) => (
                <View key={m.userId} style={styles.memberRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {m.username}{m.userId === user?.id ? ' (você)' : ''}
                    </Text>
                    <Text style={styles.memberRole}>{ROLE_LABELS[m.role]}</Text>
                  </View>
                  {canPromote(m) && (
                    <TouchableOpacity style={styles.chipBtn} onPress={() => handlePromote(m, 'admin')}>
                      <Text style={styles.chipBtnText}>Promover</Text>
                    </TouchableOpacity>
                  )}
                  {canDemote(m) && (
                    <TouchableOpacity style={styles.chipBtn} onPress={() => handlePromote(m, 'member')}>
                      <Text style={styles.chipBtnText}>Rebaixar</Text>
                    </TouchableOpacity>
                  )}
                  {canKick(m) && (
                    <TouchableOpacity style={[styles.chipBtn, styles.chipBtnDanger]} onPress={() => handleKick(m)}>
                      <Text style={[styles.chipBtnText, styles.chipBtnDangerText]}>Remover</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Zona de perigo */}
          <View style={[styles.card, styles.dangerCard]}>
            <Text style={styles.dangerTitle}>ZONA DE PERIGO</Text>
            {!isOwner ? (
              <TouchableOpacity style={styles.dangerBtnOutline} onPress={handleLeave}>
                <Text style={styles.dangerBtnOutlineText}>Sair do grupo</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.dangerBtnFill} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.dangerBtnFillText}>Excluir grupo</Text>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  headerTitle: { fontSize: FONT.lg, fontWeight: '800', color: COLORS.text },
  headerSub:   { fontSize: FONT.sm, color: COLORS.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.md },

  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderSoft, padding: SPACING.md, ...CARD_SHADOW },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: SPACING.sm },

  fieldLabel: { fontSize: FONT.sm, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 4 },
  input: { backgroundColor: COLORS.input, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.inputBorder, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: FONT.base, color: COLORS.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm },
  switchHint: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', marginTop: SPACING.md },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FONT.base },

  readRow: { fontSize: FONT.base, color: COLORS.text, marginBottom: 4 },
  readLabel: { fontWeight: '600' },

  codeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  codeBox: { flex: 1, backgroundColor: COLORS.background, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingVertical: SPACING.sm, alignItems: 'center' },
  codeText: { fontSize: FONT.lg, fontWeight: '800', letterSpacing: 4, color: COLORS.primary },
  secondaryBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  secondaryBtnText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textSecondary },
  regenBtn: { marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.orangeDim, backgroundColor: COLORS.orangeDim, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, alignItems: 'center' },
  regenBtnText: { fontSize: FONT.sm, fontWeight: '600', color: '#c2410c' },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: SPACING.sm, borderTopWidth: 1, borderColor: COLORS.borderSoft },
  memberName: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.text },
  memberRole: { fontSize: 11, color: COLORS.textMuted },
  chipBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 5 },
  chipBtnText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  chipBtnDanger: { borderColor: 'rgba(239,68,68,0.4)' },
  chipBtnDangerText: { color: COLORS.red },

  dangerCard: { borderColor: 'rgba(239,68,68,0.3)' },
  dangerTitle: { fontSize: 11, fontWeight: '700', color: COLORS.red, letterSpacing: 0.5, marginBottom: SPACING.sm },
  dangerBtnOutline: { borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  dangerBtnOutlineText: { color: COLORS.red, fontWeight: '600', fontSize: FONT.base },
  dangerBtnFill: { flexDirection: 'row', gap: 6, backgroundColor: COLORS.red, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  dangerBtnFillText: { color: '#fff', fontWeight: '700', fontSize: FONT.base },
});
