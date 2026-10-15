import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { validatePassword, validatePasswordConfirmation } from '@prodscore/shared';
import { useAuthStore } from '../store/authStore';
import { changePassword, deleteAccount } from '../services/security.service';
import { getApiErrorCode, getFriendlyErrorMessage } from '../lib/errors';
import EnrollMFA from '../components/EnrollMFA';
import InlineFeedback, { FieldError } from '../components/InlineFeedback';
import PasswordInput from '../components/PasswordInput';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

/** Erros da API que pertencem ao campo "Senha atual" (ver requireSensitiveAuth) */
const CURRENT_PASSWORD_ERRORS = new Set(['SENHA_ATUAL_INCORRETA', 'SENHA_ATUAL_OBRIGATORIA']);

type PasswordFormErrors = { current?: string | undefined; next?: string | undefined; confirm?: string | undefined };

function ChangePasswordForm() {
  const colors = useThemeColors();
  const styles = useStyles();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors,     setFieldErrors]     = useState<PasswordFormErrors>({});
  const [error,           setError]           = useState('');
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);

  const handleSubmit = async () => {
    setError('');
    setSaved(false);

    const errs: PasswordFormErrors = {
      current: currentPassword ? undefined : 'Digite sua senha atual.',
      next:    validatePassword(newPassword) ?? undefined,
      confirm: validatePasswordConfirmation(newPassword, confirmPassword) ?? undefined,
    };
    if (!errs.next && currentPassword && newPassword === currentPassword) {
      errs.next = 'A nova senha precisa ser diferente da atual.';
    }
    setFieldErrors(errs);
    if (errs.current || errs.next || errs.confirm) return;

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Erro ao alterar a senha.');
      if (CURRENT_PASSWORD_ERRORS.has(getApiErrorCode(err) ?? '')) setFieldErrors({ current: message });
      else setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: SPACING.sm }}>
      <View>
        <Text style={styles.fieldLabel}>Senha atual</Text>
        <PasswordInput
          value={currentPassword}
          onChangeText={(v) => { setCurrentPassword(v); setFieldErrors((p) => ({ ...p, current: undefined })); }}
          autoComplete="password"
          accessibilityLabel="Senha atual"
          style={fieldErrors.current ? styles.inputError : null}
        />
        <FieldError msg={fieldErrors.current} />
      </View>
      <View>
        <Text style={styles.fieldLabel}>Nova senha</Text>
        <PasswordInput
          value={newPassword}
          onChangeText={(v) => { setNewPassword(v); setFieldErrors((p) => ({ ...p, next: undefined })); }}
          autoComplete="new-password"
          accessibilityLabel="Nova senha"
          placeholder="Mín. 8 caracteres, com letras e números"
          style={fieldErrors.next ? styles.inputError : null}
        />
        <FieldError msg={fieldErrors.next} />
      </View>
      <View>
        <Text style={styles.fieldLabel}>Confirmar nova senha</Text>
        <PasswordInput
          value={confirmPassword}
          onChangeText={(v) => { setConfirmPassword(v); setFieldErrors((p) => ({ ...p, confirm: undefined })); }}
          autoComplete="new-password"
          accessibilityLabel="Confirmar nova senha"
          style={fieldErrors.confirm ? styles.inputError : null}
        />
        <FieldError msg={fieldErrors.confirm} />
      </View>

      {error ? <InlineFeedback variant="error" message={error} /> : null}
      {saved ? <InlineFeedback variant="success" message="Senha alterada com sucesso!" /> : null}

      <TouchableOpacity style={[styles.secondaryBtn, saving && { opacity: 0.6 }]} onPress={() => void handleSubmit()} disabled={saving}>
        {saving
          ? <ActivityIndicator color={colors.text} size="small" />
          : <Text style={styles.secondaryBtnText}>Alterar senha</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

/**
 * Confirmação de exclusão da conta com a senha atual. Um modal próprio (e não
 * o Alert nativo) porque o Alert não tem campo de senha no Android.
 */
function DeleteAccountModal({ onCancel, onDeleted }: { onCancel: () => void; onDeleted: () => Promise<void> }) {
  const colors = useThemeColors();
  const styles = useStyles();
  const [password,   setPassword]   = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error,      setError]      = useState('');
  const [deleting,   setDeleting]   = useState(false);

  const handleDelete = async () => {
    if (!password) { setFieldError('Digite sua senha atual para confirmar.'); return; }
    setFieldError('');
    setError('');
    setDeleting(true);
    try {
      await deleteAccount(password);
      await onDeleted();
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Erro ao excluir a conta.');
      if (CURRENT_PASSWORD_ERRORS.has(getApiErrorCode(err) ?? '')) setFieldError(message);
      else setError(message);
      setDeleting(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { if (!deleting) onCancel(); }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={() => { if (!deleting) onCancel(); }}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>Excluir conta</Text>
            <Text style={styles.sheetText}>
              Essa ação é permanente. Todos os seus dados, tarefas e histórico de pontos serão apagados.
            </Text>

            <Text style={styles.fieldLabel}>Senha atual</Text>
            <PasswordInput
              value={password}
              onChangeText={(v) => { setPassword(v); setFieldError(''); }}
              autoComplete="password"
              accessibilityLabel="Senha atual"
              returnKeyType="go"
              onSubmitEditing={() => void handleDelete()}
              style={fieldError ? styles.inputError : null}
            />
            <FieldError msg={fieldError} />
            {error ? <InlineFeedback variant="error" message={error} /> : null}

            <View style={styles.sheetBtns}>
              <TouchableOpacity style={[styles.secondaryBtn, styles.flex1]} onPress={onCancel} disabled={deleting}>
                <Text style={styles.secondaryBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtnFill, styles.flex1, deleting && { opacity: 0.6 }]}
                onPress={() => void handleDelete()}
                disabled={deleting}
                accessibilityRole="button"
              >
                {deleting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.dangerBtnFillText}>Excluir</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Tela de segurança da conta — 2FA, troca de senha e exclusão de conta */
export default function SecurityScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuthStore();
  const colors = useThemeColors();
  const styles = useStyles();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Segurança</Text>
          <Text style={styles.headerSub}>Verificação em duas etapas, senha e conta</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* 2FA */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Autenticação de dois fatores (2FA)</Text>
          <EnrollMFA />
        </View>

        {/* Alterar senha — confirma com a senha atual (e o 2FA, para quem tem) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Alterar senha</Text>
          <Text style={styles.cardHint}>Para sua segurança, confirme com a senha atual.</Text>
          <ChangePasswordForm />
        </View>

        {/* Zona de risco */}
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={[styles.cardTitle, { color: colors.red }]}>Zona de risco</Text>
          <Text style={styles.cardHint}>Excluir a conta apaga todos os seus dados. Você vai confirmar com a senha atual.</Text>
          <TouchableOpacity style={styles.dangerBtn} onPress={() => setConfirmDelete(true)} accessibilityRole="button">
            <Text style={styles.dangerBtnText}>Excluir conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {confirmDelete && (
        <DeleteAccountModal onCancel={() => setConfirmDelete(false)} onDeleted={logout} />
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: FONT.xl, fontWeight: '800', color: colors.text },
  headerSub:   { fontSize: FONT.sm, color: colors.textMuted, marginTop: 2, maxWidth: 260 },

  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl, gap: SPACING.md },

  card: {
    backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: SPACING.md, ...CARD_SHADOW,
  },
  cardTitle: { fontSize: FONT.base, fontWeight: '700', color: colors.text, marginBottom: SPACING.xs },
  cardHint:  { fontSize: FONT.sm, color: colors.textMuted, marginBottom: SPACING.md },

  dangerCard: { borderColor: 'rgba(248,113,113,0.3)' },

  fieldLabel: { fontSize: FONT.sm, fontWeight: '500', color: colors.textSecondary, marginBottom: 4 },
  inputError: { borderColor: colors.red },

  secondaryBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md,
    paddingVertical: 11, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: SPACING.lg,
  },
  secondaryBtnText: { fontSize: FONT.sm, fontWeight: '600', color: colors.textSecondary },

  dangerBtn: {
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)', borderRadius: RADIUS.md,
    paddingVertical: 11, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: SPACING.lg,
  },
  dangerBtnText: { fontSize: FONT.sm, fontWeight: '600', color: colors.red },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.lg },
  sheet: { backgroundColor: colors.card, borderRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.sm, ...CARD_SHADOW },
  sheetTitle: { fontSize: FONT.lg, fontWeight: '700', color: colors.text },
  sheetText:  { fontSize: FONT.sm, color: colors.textSecondary, marginBottom: SPACING.xs },
  sheetBtns:  { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  flex1:      { flex: 1, alignSelf: 'stretch' },
  dangerBtnFill: { backgroundColor: colors.red, borderRadius: RADIUS.md, paddingVertical: 11, alignItems: 'center' },
  dangerBtnFillText: { fontSize: FONT.sm, fontWeight: '700', color: '#fff' },
}));
