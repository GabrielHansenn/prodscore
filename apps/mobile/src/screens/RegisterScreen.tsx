import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';
import type { AuthStackParamList } from '../navigation/index';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

/** Tela de cadastro com nome de usuário, e-mail, senha e confirmação */
export default function RegisterScreen({ navigation }: Props) {
  const register = useAuthStore((s) => s.register);

  const [username,        setUsername]        = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error,           setError]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [confirmEmail,    setConfirmEmail]    = useState(false);

  const handleRegister = async () => {
    if (!username.trim())         { setError('Informe um nome de usuário.');          return; }
    if (username.trim().length < 3) { setError('Nome de usuário: mínimo 3 caracteres.'); return; }
    if (!email.trim())            { setError('Informe seu e-mail.');                   return; }
    if (!password)                { setError('Informe uma senha.');                    return; }
    if (password.length < 8)      { setError('Senha: mínimo 8 caracteres.');           return; }
    if (password !== confirmPassword) { setError('As senhas não coincidem.');           return; }

    setError('');
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'CONFIRM_EMAIL') {
        setConfirmEmail(true);
      } else {
        setError(msg || 'Erro ao criar conta. Tente novamente.');
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

          {[
            { label: 'Nome de usuário', value: username, set: setUsername, placeholder: 'meu_usuario', type: 'default' as const, secure: false },
            { label: 'E-mail',          value: email,    set: setEmail,    placeholder: 'seu@email.com', type: 'email-address' as const, secure: false },
            { label: 'Senha',           value: password, set: setPassword, placeholder: '••••••••', type: 'default' as const, secure: true },
            { label: 'Confirmar senha', value: confirmPassword, set: setConfirmPassword, placeholder: '••••••••', type: 'default' as const, secure: true },
          ].map((f) => (
            <View key={f.label} style={styles.field}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput
                style={styles.input}
                value={f.value}
                onChangeText={f.set}
                placeholder={f.placeholder}
                placeholderTextColor={COLORS.textMuted}
                keyboardType={f.type}
                autoCapitalize={f.type === 'email-address' ? 'none' : 'none'}
                secureTextEntry={f.secure}
                autoCorrect={false}
              />
            </View>
          ))}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

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

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
  logo:   { alignItems: 'center', marginBottom: SPACING.xl },
  logoText: { fontSize: 36, fontWeight: '800', color: COLORS.emerald, letterSpacing: -0.5 },
  logoSub:  { fontSize: FONT.base, color: COLORS.textMuted, marginTop: SPACING.xs },
  card: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.xl,
    borderWidth:     1,
    borderColor:     COLORS.border,
    padding:         SPACING.lg,
    gap:             SPACING.md,
  },
  title: { fontSize: FONT.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  field: { gap: SPACING.xs },
  label: { fontSize: FONT.sm, fontWeight: '500', color: COLORS.textSecondary },
  input: {
    backgroundColor:   COLORS.input,
    borderRadius:      RADIUS.md,
    borderWidth:       1,
    borderColor:       COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical:   12,
    fontSize:          FONT.base,
    color:             COLORS.text,
  },
  errorBox:  { backgroundColor: COLORS.redDim, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', padding: SPACING.sm },
  errorText: { color: COLORS.red, fontSize: FONT.sm },
  btn:       { backgroundColor: COLORS.emerald, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.xs },
  btnDisabled: { opacity: 0.6 },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: FONT.md },
  footer:    { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.lg },
  footerText: { color: COLORS.textMuted, fontSize: FONT.base },
  link:      { color: COLORS.emerald, fontWeight: '600', fontSize: FONT.base },
  confirmTitle: { fontSize: FONT.xl, fontWeight: '700', color: COLORS.text, marginTop: SPACING.md, textAlign: 'center' },
  confirmDesc:  { fontSize: FONT.base, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 22 },
});
