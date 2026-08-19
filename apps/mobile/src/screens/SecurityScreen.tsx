import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { decodeJwtAal } from '../lib/jwt';
import { changePassword, deleteAccount } from '../services/security.service';
import EnrollMFA from '../components/EnrollMFA';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';

/** Aviso exibido no lugar de uma ação sensível quando a sessão ainda não está em aal2 */
function RequireAAL2Notice() {
  return (
    <View style={styles.aal2Notice}>
      <Ionicons name="lock-closed-outline" size={16} color={COLORS.amber} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.aal2NoticeTitle}>Esta ação exige verificação em duas etapas.</Text>
        <Text style={styles.aal2NoticeSub}>
          Ative o 2FA acima e confirme o código do seu aplicativo autenticador para continuar.
        </Text>
      </View>
    </View>
  );
}

function ChangePasswordForm() {
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error,           setError]           = useState('');
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (newPassword.length < 8) { setError('A nova senha deve ter no mínimo 8 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setError('As senhas não coincidem.'); return; }

    setSaving(true);
    try {
      await changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar a senha.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: SPACING.sm }}>
      <View>
        <Text style={styles.fieldLabel}>Nova senha</Text>
        <TextInput
          style={styles.input} value={newPassword} onChangeText={setNewPassword}
          secureTextEntry autoCapitalize="none"
        />
      </View>
      <View>
        <Text style={styles.fieldLabel}>Confirmar nova senha</Text>
        <TextInput
          style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
          secureTextEntry autoCapitalize="none"
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {saved ? <Text style={styles.savedText}>Senha alterada com sucesso!</Text> : null}

      <TouchableOpacity style={[styles.secondaryBtn, saving && { opacity: 0.6 }]} onPress={() => void handleSubmit()} disabled={saving}>
        {saving
          ? <ActivityIndicator color={COLORS.text} size="small" />
          : <Text style={styles.secondaryBtnText}>Alterar senha</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

/** Tela de segurança da conta — 2FA, troca de senha e exclusão de conta */
export default function SecurityScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const insets = useSafeAreaInsets();
  const { accessToken, logout } = useAuthStore();
  const [deleteError, setDeleteError] = useState('');
  const [deleting,    setDeleting]    = useState(false);

  const isAAL2 = accessToken !== null && decodeJwtAal(accessToken) === 'aal2';

  const handleDeleteAccount = () => {
    Alert.alert(
      'Excluir conta',
      'Essa ação é permanente. Todos os seus dados, tarefas e histórico de pontos serão apagados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir permanentemente',
          style: 'destructive',
          onPress: () => void (async () => {
            setDeleteError('');
            setDeleting(true);
            try {
              await deleteAccount();
              await logout();
            } catch (err) {
              setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir a conta.');
            } finally {
              setDeleting(false);
            }
          })(),
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Segurança</Text>
          <Text style={styles.headerSub}>Autenticação de dois fatores e configurações sensíveis</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 2FA */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Autenticação de dois fatores (2FA)</Text>
          <EnrollMFA />
        </View>

        {/* Alterar senha — exige aal2 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Alterar senha</Text>
          {isAAL2 ? <ChangePasswordForm /> : <RequireAAL2Notice />}
        </View>

        {/* Zona de risco — exige aal2 */}
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={[styles.cardTitle, { color: COLORS.red }]}>Zona de risco</Text>
          {isAAL2 ? (
            <View>
              {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
              <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount} disabled={deleting}>
                {deleting
                  ? <ActivityIndicator color={COLORS.red} size="small" />
                  : <Text style={styles.dangerBtnText}>Excluir conta</Text>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <RequireAAL2Notice />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: FONT.xl, fontWeight: '800', color: COLORS.text },
  headerSub:   { fontSize: FONT.sm, color: COLORS.textMuted, marginTop: 2, maxWidth: 260 },

  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.md },

  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderSoft,
    padding: SPACING.md, ...CARD_SHADOW,
  },
  cardTitle: { fontSize: FONT.base, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },

  dangerCard: { borderColor: 'rgba(248,113,113,0.3)' },

  aal2Notice: {
    flexDirection: 'row', gap: SPACING.sm,
    backgroundColor: COLORS.amberDim, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', padding: SPACING.sm,
  },
  aal2NoticeTitle: { fontSize: FONT.sm, fontWeight: '600', color: '#b45309' },
  aal2NoticeSub:   { fontSize: 11, color: '#b45309', opacity: 0.9, marginTop: 2 },

  fieldLabel: { fontSize: FONT.sm, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.input, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.inputBorder,
    paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: FONT.base, color: COLORS.text,
  },

  errorText: { fontSize: 12, color: COLORS.red, backgroundColor: COLORS.redDim, borderRadius: RADIUS.sm, padding: SPACING.sm },
  savedText: { fontSize: 12, color: COLORS.success, backgroundColor: COLORS.successDim, borderRadius: RADIUS.sm, padding: SPACING.sm },

  secondaryBtn: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingVertical: 11, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: SPACING.lg,
  },
  secondaryBtnText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textSecondary },

  dangerBtn: {
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)', borderRadius: RADIUS.md,
    paddingVertical: 11, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
  },
  dangerBtnText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.red },
});
