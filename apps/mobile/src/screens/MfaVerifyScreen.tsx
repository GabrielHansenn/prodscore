import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { translateMFAErrorMessage } from '../services/mfa.service';
import InlineFeedback from '../components/InlineFeedback';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

/**
 * Tela de verificação em duas etapas exibida após o login com e-mail e senha
 * quando o usuário tem 2FA ativo (sessão em aal1, aguardando step-up pra aal2).
 * Renderizada diretamente pela navegação raiz enquanto `mfaPending` for true.
 */
export default function MfaVerifyScreen() {
  const { verifyMfaChallenge, logout, isLoading } = useAuthStore();
  const colors = useThemeColors();
  const styles = useStyles();

  const [code,   setCode]   = useState('');
  const [error,  setError]  = useState('');

  const handleConfirm = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Digite os 6 dígitos do código exibido no aplicativo autenticador.');
      return;
    }
    setError('');
    try {
      await verifyMfaChallenge(code);
    } catch (err) {
      setError(err instanceof Error ? translateMFAErrorMessage(err.message) : 'Código inválido. Tente novamente.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Text style={styles.logoText}>ProdScore</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Verificação em duas etapas</Text>
          <Text style={styles.subtitle}>
            Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador.
          </Text>

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />

          {error ? <View style={{ width: '100%' }}><InlineFeedback variant="error" message={error} /></View> : null}

          <TouchableOpacity
            style={[styles.btn, isLoading && styles.btnDisabled]}
            onPress={() => void handleConfirm()}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>Confirmar</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => void logout()} disabled={isLoading}>
            <Text style={styles.cancelText}>Voltar para o login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
  logo:   { alignItems: 'center', marginBottom: SPACING.xl },
  logoText: { fontSize: 36, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },

  card: { gap: SPACING.md, alignItems: 'center' },
  title:    { fontSize: FONT.xxl, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: FONT.base, color: colors.textMuted, textAlign: 'center', marginBottom: SPACING.sm },

  codeInput: {
    width: '100%',
    backgroundColor: colors.input,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     colors.border,
    paddingVertical: 14,
    fontSize:        FONT.xxl,
    letterSpacing:   12,
    textAlign:       'center',
    color:           colors.text,
  },

  btn: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius:    RADIUS.md,
    paddingVertical: 14,
    alignItems:      'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: FONT.md },

  cancelBtn:  { marginTop: SPACING.xs },
  cancelText: { color: colors.textMuted, fontSize: FONT.sm, fontWeight: '500' },
}));
