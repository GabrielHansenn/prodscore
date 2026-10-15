import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { validateEmail } from '@prodscore/shared';
import { api } from '../services/api';
import { getFriendlyErrorMessage } from '../lib/errors';
import InlineFeedback, { FieldError } from '../components/InlineFeedback';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';
import type { AuthStackParamList } from '../navigation/index';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

/**
 * "Esqueci minha senha": pede o e-mail e manda o link de redefinição
 * (POST /auth/forgot-password). O link abre a página do site onde a nova
 * senha é criada; depois a pessoa volta e entra no app normalmente.
 */
export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useStyles();
  const [email,      setEmail]      = useState(route.params?.email ?? '');
  const [fieldError, setFieldError] = useState('');
  const [error,      setError]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [sent,       setSent]       = useState(false);

  const handleSend = async () => {
    const emailError = validateEmail(email);
    if (emailError) { setFieldError(emailError); return; }

    setFieldError('');
    setError('');
    setSending(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Não foi possível enviar o e-mail. Tente novamente.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>

        {sent ? (
          <View style={styles.card}>
            <Ionicons name="mail-outline" size={40} color={colors.primary} />
            <Text style={styles.title}>Confira seu e-mail</Text>
            <Text style={styles.text}>
              Se existir uma conta com {email.trim()}, enviamos um link para criar uma nova senha. O link vale por 1 hora.
            </Text>
            <Text style={styles.hint}>Não chegou? Procure na pasta de spam ou envie de novo.</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setSent(false)}>
              <Text style={styles.secondaryBtnText}>Enviar de novo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.btnText}>Voltar para o login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.title}>Esqueceu a senha?</Text>
            <Text style={styles.text}>Digite o e-mail da sua conta e enviaremos um link para você criar uma nova senha.</Text>

            <View style={styles.field}>
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={[styles.input, fieldError ? styles.inputError : null]}
                value={email}
                onChangeText={(v) => { setEmail(v); setFieldError(''); }}
                placeholder="seu@email.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                autoFocus
                returnKeyType="send"
                onSubmitEditing={() => void handleSend()}
                accessibilityLabel="E-mail"
              />
              <FieldError msg={fieldError} />
            </View>

            {error ? <InlineFeedback variant="error" message={error} /> : null}

            <TouchableOpacity style={[styles.btn, sending && { opacity: 0.6 }]} onPress={() => void handleSend()} disabled={sending}>
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Enviar link</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
  back:   { position: 'absolute', top: SPACING.lg, left: SPACING.lg, zIndex: 1 },
  card:   { gap: SPACING.md },
  title:  { fontSize: FONT.xxl, fontWeight: '700', color: colors.text },
  text:   { fontSize: FONT.base, color: colors.textSecondary, lineHeight: 21 },
  hint:   { fontSize: FONT.sm, color: colors.textMuted },
  field:  { gap: SPACING.xs },
  label:  { fontSize: FONT.sm, fontWeight: '500', color: colors.textSecondary },
  input: {
    backgroundColor: colors.input, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: FONT.base, color: colors.text,
  },
  inputError: { borderColor: colors.red },
  btn:     { backgroundColor: colors.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FONT.md },
  secondaryBtn:     { borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center' },
  secondaryBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: FONT.base },
}));
