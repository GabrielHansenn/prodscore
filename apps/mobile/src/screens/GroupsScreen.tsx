import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MemberRole, validateRequired, validateInviteCode } from '@prodscore/shared';
import GroupCard, { type GroupCardData } from '../components/GroupCard';
import { api } from '../services/api';
import { getFriendlyErrorMessage } from '../lib/errors';
import { showToast } from '../store/toastStore';
import InlineFeedback from '../components/InlineFeedback';
import { useResponsive, SIDEBAR_WIDTH } from '../lib/useResponsive';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';
import type { AppStackParamList } from '../navigation/index';

// ---------------------------------------------------------------------------
// Serviço inline (mobile consome a mesma API via axios)
// ---------------------------------------------------------------------------

interface MobileGroup {
  id:          string;
  name:        string;
  description: string | null;
  inviteCode:  string;
  createdAt:   string;
  role:        MemberRole;
  memberCount: number;
}

async function fetchGroups(): Promise<MobileGroup[]> {
  const { data } = await api.get<{ grupos: MobileGroup[] }>('/groups');
  return data.grupos;
}

async function createGroupApi(name: string, description?: string): Promise<MobileGroup> {
  const { data } = await api.post<{ grupo: MobileGroup }>('/groups', { name, description });
  return data.grupo;
}

async function joinGroupApi(inviteCode: string): Promise<MobileGroup> {
  const { data } = await api.post<{ grupo: MobileGroup }>('/groups/join', { invite_code: inviteCode });
  return data.grupo;
}

// ---------------------------------------------------------------------------
// Modal de criar grupo
// ---------------------------------------------------------------------------

function CreateModal({ visible, onClose, onCreate }: {
  visible: boolean;
  onClose: () => void;
  onCreate: (g: MobileGroup) => void;
}) {
  const [name,    setName]    = useState('');
  const [desc,    setDesc]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    const nameError = validateRequired(name, 'Nome do grupo');
    if (nameError) { setError(nameError); return; }
    setError('');
    setLoading(true);
    try {
      const g = await createGroupApi(name.trim(), desc.trim() || undefined);
      onCreate(g);
      setName(''); setDesc(''); onClose();
      showToast('Grupo criado com sucesso!');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Erro ao criar grupo.'));
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.modalTitle}>Criar Grupo</Text>
          <Text style={styles.fieldLabel}>Nome do grupo</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex: Devs Produtivos" placeholderTextColor={COLORS.textMuted} autoFocus />
          <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Descrição (opcional)</Text>
          <TextInput style={[styles.input, { height: 72 }]} value={desc} onChangeText={setDesc} placeholder="Do que se trata este grupo?" placeholderTextColor={COLORS.textMuted} multiline />
          {error ? <InlineFeedback variant="error" message={error} /> : null}
          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={() => void handleCreate()} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Criar Grupo</Text>}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modal de entrar por código
// ---------------------------------------------------------------------------

function JoinModal({ visible, onClose, onJoin }: {
  visible: boolean;
  onClose: () => void;
  onJoin: (g: MobileGroup) => void;
}) {
  const [code,    setCode]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const codeError = validateInviteCode(code);
    if (codeError) { setError(codeError); return; }
    setError('');
    setLoading(true);
    try {
      const g = await joinGroupApi(code.trim());
      onJoin(g);
      setCode(''); onClose();
      showToast(`Você entrou no grupo "${g.name}"!`);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Código de convite inválido.'));
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.modalTitle}>Entrar com Código</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="EX: AB12CD"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
            autoFocus
            maxLength={8}
          />
          {error ? <InlineFeedback variant="error" message={error} /> : null}
          <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={() => void handleJoin()} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Entrar no Grupo</Text>}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tela de grupos
// ---------------------------------------------------------------------------

/** Tela de listagem de grupos com criação e entrada por código */
export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const { isWide } = useResponsive();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [groups,      setGroups]      = useState<MobileGroup[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [showJoin,    setShowJoin]    = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setGroups(await fetchGroups());
      } catch (err) {
        showToast(getFriendlyErrorMessage(err, 'Erro ao carregar seus grupos.'), 'error');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const toCardData = (g: MobileGroup): GroupCardData => ({
    id:          g.id,
    name:        g.name,
    description: g.description,
    memberCount: g.memberCount,
    role:        g.role,
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingLeft: isWide ? SIDEBAR_WIDTH : 0 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Grupos</Text>
          <Text style={styles.headerSub}>Colabore e compita com outros jogadores</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowJoin(true)}>
            <Text style={styles.btnSecondaryText}>Entrar com Código</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowCreate(true)}>
            <Text style={styles.btnPrimaryText}>+ Criar Grupo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>👥</Text>
          <Text style={styles.emptyText}>Nenhum grupo ainda</Text>
          <Text style={styles.emptyHint}>Use os botões acima para criar ou entrar em um grupo</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => (
            <GroupCard
              group={toCardData(item)}
              onPress={() => navigation.navigate('GroupDetail', { groupId: item.id, groupName: item.name })}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <CreateModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={(g) => setGroups((prev) => [g, ...prev])}
      />
      <JoinModal
        visible={showJoin}
        onClose={() => setShowJoin(false)}
        onJoin={(g) => setGroups((prev) => [g, ...prev])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    gap: SPACING.sm, padding: SPACING.md, paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: FONT.xl, fontWeight: '800', color: COLORS.text },
  headerSub:   { fontSize: FONT.sm, color: COLORS.textMuted, marginTop: 2 },
  list:        { padding: SPACING.md, paddingBottom: SPACING.xl },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, padding: SPACING.xl },
  emptyText:   { fontSize: FONT.lg, fontWeight: '600', color: COLORS.textSecondary },
  emptyHint:   { fontSize: FONT.base, color: COLORS.textMuted, textAlign: 'center' },

  headerActions: { flexDirection: 'row', gap: SPACING.sm },
  btnSecondary: {
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10,
  },
  btnSecondaryText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textSecondary },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10,
  },
  btnPrimaryText: { fontSize: FONT.sm, fontWeight: '600', color: '#fff' },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:   { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.sm },
  handle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.sm },
  modalTitle: { fontSize: FONT.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  fieldLabel: { fontSize: FONT.sm, fontWeight: '500', color: COLORS.textSecondary },
  input:      { backgroundColor: COLORS.input, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: FONT.base, color: COLORS.text },
  codeInput:  { textAlign: 'center', fontSize: FONT.xl, letterSpacing: 8, fontWeight: '700' },
  btn:        { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.xs },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: FONT.md },
});
