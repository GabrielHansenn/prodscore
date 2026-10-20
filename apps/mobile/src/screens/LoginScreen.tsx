import { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { getFriendlyErrorMessage, getApiErrorCode } from '../lib/errors';
import { api } from '../services/api';
import InlineFeedback from '../components/InlineFeedback';
import PasswordInput from '../components/PasswordInput';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';
import type { AuthStackParamList } from '../navigation/index';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

/** Tela de login com e-mail e senha */
export default function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((s) => s.login);
  const colors = useThemeColors();
  const styles = useStyles();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  // Senha certa, e-mail ainda não confirmado: mostra o aviso com "reenviar"
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email.trim())    { setError('Informe seu e-mail ou nome de usuário.');  return; }
    if (!password.trim()) { setError('Informe sua senha.');   return; }
    setError('');
    setNeedsConfirm(false);
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Navegação é tratada pelo RootNavigator via isAuthenticated
    } catch (err) {
      if (getApiErrorCode(err) === 'EMAIL_NAO_CONFIRMADO') {
        setNeedsConfirm(true);
        setResendStatus('idle');
      } else {
        setError(getFriendlyErrorMessage(err, 'E-mail, usuário ou senha incorretos.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendStatus('sending');
    try {
      await api.post('/auth/resend-confirmation', { email: email.trim() });
      setResendStatus('sent');
    } catch (err) {
      setResendStatus('idle');
      setError(getFriendlyErrorMessage(err, 'Não foi possível reenviar o e-mail. Tente novamente.'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logo}>
          <Text style={styles.logoText}>ProdScore</Text>
          <Text style={styles.logoSub}>Gamifique sua produtividade</Text>
        </View>

        {/* Formulário */}
        <View style={styles.card}>
          <Text style={styles.title}>Bem-vindo de volta</Text>
          <Text style={styles.subtitle}>Entre com sua conta para continuar</Text>

          <View style={styles.field}>
            {/* Aceita e-mail OU nome de usuário: a API acha a conta */}
            <Text style={styles.label}>E-mail ou nome de usuário</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com ou seu_usuario"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
              accessibilityLabel="E-mail ou nome de usuário"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <PasswordInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={() => void handleLogin()}
              accessibilityLabel="Senha"
            />
            <TouchableOpacity
              // Só leva o texto digitado se for um e-mail (a recuperação é por e-mail)
              onPress={() => navigation.navigate('ForgotPassword', email.includes('@') ? { email: email.trim() } : {})}
              style={styles.forgot}
              accessibilityRole="link"
            >
              <Text style={styles.forgotText}>Esqueci minha senha</Text>
            </TouchableOpacity>
          </View>

          {/* E-mail não confirmado — mesmo aviso do web, com reenvio */}
          {needsConfirm && (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>Confirme seu e-mail antes de entrar.</Text>
              {/* Com o nome de usuário, o e-mail não é mostrado (nunca sai do servidor):
                  o reenvio só aparece para quem entrou digitando o e-mail */}
              <Text style={styles.confirmText}>
                {email.includes('@')
                  ? `Enviamos um link para ${email.trim()}. Procure também no spam.`
                  : 'Procure o link que enviamos para o seu e-mail no cadastro (veja também o spam). Para receber de novo, entre com o seu e-mail.'}
              </Text>
              {!email.includes('@') ? null : resendStatus === 'sent' ? (
                <Text style={styles.confirmSent}>E-mail reenviado!</Text>
              ) : (
                <TouchableOpacity onPress={() => void handleResend()} disabled={resendStatus === 'sending'} accessibilityRole="button">
                  <Text style={styles.confirmLink}>
                    {resendStatus === 'sending' ? 'Enviando…' : 'Reenviar e-mail de confirmação'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {error ? <InlineFeedback variant="error" message={error} /> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={() => void handleLogin()}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.btnText}>Entrar</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Link para cadastro */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Não tem conta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>Cadastre-se</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow:       1,
    justifyContent: 'center',
    padding:        SPACING.lg,
  },
  logo: {
    alignItems:   'center',
    marginBottom: SPACING.xl,
  },
  logoText: {
    fontSize:   36,
    fontWeight: '800',
    color:      colors.primary,
    letterSpacing: -0.5,
  },
  logoSub: {
    fontSize:  FONT.base,
    color:     colors.textMuted,
    marginTop: SPACING.xs,
  },
  card: {
    gap: SPACING.md,
  },
  title: {
    fontSize:     FONT.xxl,
    fontWeight:   '700',
    color:        colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize:     FONT.base,
    color:        colors.textMuted,
    marginBottom: SPACING.md,
  },
  field: {
    gap: SPACING.xs,
  },
  label: {
    fontSize:   FONT.sm,
    fontWeight: '500',
    color:      colors.textSecondary,
  },
  input: {
    backgroundColor: colors.input,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     colors.border,
    paddingHorizontal: SPACING.md,
    paddingVertical:   12,
    fontSize:        FONT.base,
    color:           colors.text,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius:    RADIUS.md,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       SPACING.xs,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  forgot:     { alignSelf: 'flex-end', paddingVertical: SPACING.xs },
  forgotText: { fontSize: FONT.sm, fontWeight: '600', color: colors.primary },
  confirmBox: {
    backgroundColor: colors.amberDim,
    borderRadius:    RADIUS.md,
    padding:         SPACING.md,
    gap:             SPACING.xs,
  },
  confirmTitle: { fontSize: FONT.sm, fontWeight: '700', color: colors.amberText },
  confirmText:  { fontSize: FONT.sm, color: colors.amberText },
  confirmLink:  { fontSize: FONT.sm, fontWeight: '700', color: colors.amberText, textDecorationLine: 'underline', paddingVertical: SPACING.xs },
  confirmSent:  { fontSize: FONT.sm, fontWeight: '700', color: colors.success },
  btnText: {
    color:      '#fff',
    fontWeight: '700',
    fontSize:   FONT.md,
  },
  footer: {
    flexDirection:  'row',
    justifyContent: 'center',
    marginTop:      SPACING.lg,
  },
  footerText: {
    color:    colors.textMuted,
    fontSize: FONT.base,
  },
  link: {
    color:      colors.primary,
    fontWeight: '600',
    fontSize:   FONT.base,
  },
}));
