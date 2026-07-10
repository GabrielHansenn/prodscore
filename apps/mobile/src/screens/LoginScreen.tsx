import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';
import type { AuthStackParamList } from '../navigation/index';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

/** Tela de login com e-mail e senha */
export default function LoginScreen({ navigation }: Props) {
  const login = useAuthStore((s) => s.login);

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
      const msg = err instanceof Error ? err.message : 'E-mail ou senha incorretos.';
      setError(msg.replace(/^Error:\s*/, ''));
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
          <Text style={styles.title}>Entrar</Text>

          <View style={styles.field}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={COLORS.textMuted}
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
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

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

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: COLORS.background,
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
    color:      COLORS.emerald,
    letterSpacing: -0.5,
  },
  logoSub: {
    fontSize:  FONT.base,
    color:     COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.xl,
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         SPACING.lg,
    gap:             SPACING.md,
  },
  title: {
    fontSize:     FONT.xl,
    fontWeight:   '700',
    color:        COLORS.text,
    marginBottom: SPACING.xs,
  },
  field: {
    gap: SPACING.xs,
  },
  label: {
    fontSize:   FONT.sm,
    fontWeight: '500',
    color:      COLORS.textSecondary,
  },
  input: {
    backgroundColor: COLORS.input,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical:   12,
    fontSize:        FONT.base,
    color:           COLORS.text,
  },
  errorBox: {
    backgroundColor: COLORS.redDim,
    borderRadius:    RADIUS.sm,
    borderWidth:     1,
    borderColor:     'rgba(248,113,113,0.3)',
    padding:         SPACING.sm,
  },
  errorText: {
    color:    COLORS.red,
    fontSize: FONT.sm,
  },
  btn: {
    backgroundColor: COLORS.emerald,
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
    color:    COLORS.textMuted,
    fontSize: FONT.base,
  },
  link: {
    color:      COLORS.emerald,
    fontWeight: '600',
    fontSize:   FONT.base,
  },
});
