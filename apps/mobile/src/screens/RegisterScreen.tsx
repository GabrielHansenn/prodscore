import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { validateUsername, validateEmail, validatePassword, validatePasswordConfirmation } from '@prodscore/shared';
import { useAuthStore } from '../store/authStore';
import { getFriendlyErrorMessage } from '../lib/errors';
import InlineFeedback, { FieldError } from '../components/InlineFeedback';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';
import type { AuthStackParamList } from '../navigation/index';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

interface FieldErrors {
  username?:        string;
  email?:           string;
  password?:        string;
  confirmPassword?: string;
}

/** Tela de cadastro com nome de usuário, e-mail, senha e confirmação */
export default function RegisterScreen({ navigation }: Props) {
  const register = useAuthStore((s) => s.register);
  const colors = useThemeColors();
  const styles = useStyles();

  const [username,        setUsername]        = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors,     setFieldErrors]     = useState<FieldErrors>({});
  const [globalError,     setGlobalError]     = useState('');
  const [loading,         setLoading]         = useState(false);
  const [confirmEmail,    setConfirmEmail]    = useState(false);

  const handleRegister = async () => {
    const errs: FieldErrors = {};
    const usernameErr = validateUsername(username);
    if (usernameErr) errs.username = usernameErr;
    const emailErr = validateEmail(email);
    if (emailErr) errs.email = emailErr;
    const passwordErr = validatePassword(password);
    if (passwordErr) errs.password = passwordErr;
    const confirmErr = validatePasswordConfirmation(password, confirmPassword);
    if (confirmErr) errs.confirmPassword = confirmErr;

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setGlobalError('');
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
    } catch (err) {
      if (err instanceof Error && err.message === 'CONFIRM_EMAIL') {
        setConfirmEmail(true);
      } else {
        setGlobalError(getFriendlyErrorMessage(err, 'Erro ao criar conta. Tente novamente.'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Tela de confirmação de e-mail
  if (confirmEmail) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.logoText}>✉️</Text>
        <Text style={styles.confirmTitle}>Verifique seu e-mail</Text>
        <Text style={styles.confirmDesc}>
          Enviamos um link de confirmação para {email.trim()}.{'\n'}
          Confirme para ativar sua conta.
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.btn}>
          <Text style={styles.btnText}>Ir para o Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <Text style={styles.logoText}>ProdScore</Text>
          <Text style={styles.logoSub}>Crie sua conta grátis</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Criar Conta</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Nome de usuário</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={(v) => { setUsername(v); if (fieldErrors.username) setFieldErrors((p) => ({ ...p, username: undefined })); }}
              placeholder="meu_usuario"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <FieldError msg={fieldErrors.username} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(v) => { setEmail(v); if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined })); }}
              placeholder="seu@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <FieldError msg={fieldErrors.email} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={(v) => { setPassword(v); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined })); }}
              placeholder="Mín. 8 caracteres, com letras e números"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCorrect={false}
            />
            <FieldError msg={fieldErrors.password} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirmar senha</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: undefined })); }}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCorrect={false}
            />
            <FieldError msg={fieldErrors.confirmPassword} />
          </View>

          {globalError ? <InlineFeedback variant="error" message={globalError} /> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={() => void handleRegister()}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>Criar conta</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Já tem conta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}>Entre aqui</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
  logo:   { alignItems: 'center', marginBottom: SPACING.xl },
  logoText: { fontSize: 36, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  logoSub:  { fontSize: FONT.base, color: colors.textMuted, marginTop: SPACING.xs },
  card: {
    gap: SPACING.md,
  },
  title: { fontSize: FONT.xxl, fontWeight: '700', color: colors.text, marginBottom: SPACING.xs },
  field: { gap: SPACING.xs },
  label: { fontSize: FONT.sm, fontWeight: '500', color: colors.textSecondary },
  input: {
    backgroundColor:   colors.input,
    borderRadius:      RADIUS.md,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingHorizontal: SPACING.md,
    paddingVertical:   12,
    fontSize:          FONT.base,
    color:             colors.text,
  },
  btn:       { backgroundColor: colors.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.xs },
  btnDisabled: { opacity: 0.6 },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: FONT.md },
  footer:    { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  footerText: { color: colors.textMuted, fontSize: FONT.base },
  link:      { color: colors.primary, fontWeight: '600', fontSize: FONT.base },
  confirmTitle: { fontSize: FONT.xl, fontWeight: '700', color: colors.text, marginTop: SPACING.md, textAlign: 'center' },
  confirmDesc:  { fontSize: FONT.base, color: colors.textSecondary, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 22 },
}));
