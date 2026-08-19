import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { translateMFAErrorMessage } from '../services/mfa.service';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

/**
 * Tela de verificação em duas etapas exibida após o login com e-mail e senha
 * quando o usuário tem 2FA ativo (sessão em aal1, aguardando step-up pra aal2).
 * Renderizada diretamente pela navegação raiz enquanto `mfaPending` for true.
 */
export default function MfaVerifyScreen() {
  const { verifyMfaChallenge, logout, isLoading } = useAuthStore();

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
            placeholderTextColor={COLORS.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

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

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
  logo:   { alignItems: 'center', marginBottom: SPACING.xl },
  logoText: { fontSize: 36, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },

  card: { gap: SPACING.md, alignItems: 'center' },
  title:    { fontSize: FONT.xxl, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: FONT.base, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.sm },

  codeInput: {
    width: '100%',
    backgroundColor: COLORS.input,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
    paddingVertical: 14,
    fontSize:        FONT.xxl,
    letterSpacing:   12,
    textAlign:       'center',
    color:           COLORS.text,
  },

  errorBox: {
    width: '100%',
    backgroundColor: COLORS.redDim,
    borderRadius:    RADIUS.sm,
    borderWidth:     1,
    borderColor:     'rgba(248,113,113,0.3)',
    padding:         SPACING.sm,
  },
  errorText: { color: COLORS.red, fontSize: FONT.sm, textAlign: 'center' },

  btn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius:    RADIUS.md,
    paddingVertical: 14,
    alignItems:      'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: FONT.md },

  cancelBtn:  { marginTop: SPACING.xs },
  cancelText: { color: COLORS.textMuted, fontSize: FONT.sm, fontWeight: '500' },
});
