import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { getFriendlyErrorMessage } from '../lib/errors';
import InlineFeedback from '../components/InlineFeedback';
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

  const handleLogin = async () => {
    if (!email.trim())    { setError('Informe seu e-mail.');  return; }
    if (!password.trim()) { setError('Informe sua senha.');   return; }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Navegação é tratada pelo RootNavigator via isAuthenticated
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'E-mail ou senha incorretos.'));
    } finally {
      setLoading(false);
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
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
          </View>

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
