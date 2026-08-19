import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { MFAFactorStatus } from '@prodscore/shared';
import {
  enrollMfa, verifyMfaCode, unenrollMfa, getMfaFactors, translateMFAErrorMessage,
  type TOTPEnrollment,
} from '../services/mfa.service';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

type Phase = 'checking' | 'active' | 'setup' | 'success' | 'error';

/**
 * Componente de ativação e gerenciamento de 2FA (TOTP) — espelha EnrollMFA.tsx
 * da web, mas fala com o backend (rotas /auth/mfa/*) em vez do SDK do
 * Supabase direto, e desenha o próprio QR code a partir da otpauthUri (RN não
 * tem como injetar o SVG que o Supabase devolve como a web faz).
 */
export default function EnrollMFA() {
  const [phase,      setPhase]      = useState<Phase>('checking');
  const [factorId,   setFactorId]   = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TOTPEnrollment | null>(null);
  const [code,       setCode]       = useState('');
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied,     setCopied]     = useState(false);

  const startEnrollment = useCallback(async () => {
    setError('');
    setCode('');
    setPhase('checking');
    try {
      const data = await enrollMfa();
      setFactorId(data.factorId);
      setEnrollment(data);
      setPhase('setup');
    } catch {
      setError('Não foi possível iniciar a ativação do 2FA. Tente novamente.');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const factors = await getMfaFactors();
        if (cancelled) return;

        const activeFactor = factors.find((f) => f.status === MFAFactorStatus.Verified);
        if (activeFactor) {
          setFactorId(activeFactor.id);
          setPhase('active');
          return;
        }

        // Remove enrollments incompletos/abandonados antes de iniciar um novo
        const staleFactors = factors.filter((f) => f.status === MFAFactorStatus.Unverified);
        if (staleFactors.length > 0) {
          await Promise.all(staleFactors.map((f) => unenrollMfa(f.id)));
          if (cancelled) return;
        }

        const data = await enrollMfa();
        if (cancelled) {
          void unenrollMfa(data.factorId);
          return;
        }

        setFactorId(data.factorId);
        setEnrollment(data);
        setPhase('setup');
      } catch {
        if (!cancelled) {
          setError('Não foi possível iniciar a ativação do 2FA. Tente novamente.');
          setPhase('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleConfirm = async () => {
    if (!factorId) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Digite os 6 dígitos do código exibido no aplicativo autenticador.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await verifyMfaCode(factorId, code);
      setPhase('success');
    } catch (err) {
      setError(err instanceof Error ? translateMFAErrorMessage(err.message) : 'Não foi possível confirmar o código.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = async () => {
    if (!factorId) return;
    setError('');
    setSubmitting(true);
    try {
      await unenrollMfa(factorId);
      setFactorId(null);
      await startEnrollment();
    } catch {
      setError('Não foi possível desativar o 2FA. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopySecret = async () => {
    if (!enrollment) return;
    await Clipboard.setStringAsync(enrollment.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (phase === 'checking') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (phase === 'active') {
    return (
      <View>
        <View style={styles.activeBox}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeTitle}>Autenticação de dois fatores ativa</Text>
            <Text style={styles.activeSub}>Sua conta está protegida por um aplicativo autenticador.</Text>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity onPress={() => void handleDisable()} disabled={submitting} style={styles.disableBtn}>
          <Text style={styles.disableText}>{submitting ? 'Desativando...' : 'Desativar 2FA'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void startEnrollment()}>
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'success') {
    return (
      <View style={styles.activeBox}>
        <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
        <View style={{ flex: 1 }}>
          <Text style={styles.activeTitle}>2FA ativado com sucesso!</Text>
          <Text style={styles.activeSub}>
            A partir de agora, você vai precisar do código do autenticador para entrar.
          </Text>
        </View>
      </View>
    );
  }

  // phase === 'setup'
  return (
    <View>
      <Text style={styles.setupHint}>
        Escaneie o QR code abaixo com um aplicativo autenticador (Google Authenticator, Authy, 1Password, etc.)
        e digite o código gerado para confirmar a ativação.
      </Text>

      {enrollment && (
        <View style={styles.qrBox}>
          <QRCode value={enrollment.otpauthUri} size={160} />
        </View>
      )}

      {enrollment && (
        <View style={styles.secretBox}>
          <Text style={styles.secretHint}>Não conseguiu escanear? Digite o código manualmente:</Text>
          <View style={styles.secretRow}>
            <Text style={styles.secretText} numberOfLines={1}>{enrollment.secret}</Text>
            <TouchableOpacity onPress={() => void handleCopySecret()} hitSlop={8}>
              <Ionicons name="copy-outline" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          {copied && <Text style={styles.copiedText}>Copiado!</Text>}
        </View>
      )}

      <Text style={styles.fieldLabel}>Código de 6 dígitos</Text>
      <TextInput
        style={styles.codeInput}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        placeholderTextColor={COLORS.textMuted}
        keyboardType="number-pad"
        maxLength={6}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.confirmBtn, submitting && { opacity: 0.6 }]}
        onPress={() => void handleConfirm()}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.confirmBtnText}>Ativar</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: SPACING.lg, alignItems: 'center' },

  activeBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: COLORS.successDim, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', padding: SPACING.md,
  },
  activeTitle: { fontSize: FONT.sm, fontWeight: '600', color: '#047857' },
  activeSub:   { fontSize: 11, color: '#047857', opacity: 0.85, marginTop: 2 },

  disableBtn:  { marginTop: SPACING.md },
  disableText: { color: COLORS.red, fontSize: FONT.sm, fontWeight: '600' },

  retryBtn: {
    marginTop: SPACING.md, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  retryText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.textSecondary },

  setupHint: { fontSize: FONT.sm, color: COLORS.textMuted, marginBottom: SPACING.md, lineHeight: 19 },

  qrBox: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, marginBottom: SPACING.md,
  },

  secretBox: { marginBottom: SPACING.md },
  secretHint: { fontSize: 11, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 6 },
  secretRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.borderSoft, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm,
  },
  secretText: { flex: 1, fontSize: 11, color: COLORS.textSecondary },
  copiedText: { fontSize: 11, color: COLORS.success, marginTop: 4 },

  fieldLabel: { fontSize: FONT.sm, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 6 },
  codeInput: {
    backgroundColor: COLORS.input, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 12, fontSize: FONT.lg, letterSpacing: 8,
    textAlign: 'center', color: COLORS.text, marginBottom: SPACING.sm,
  },

  errorText: {
    fontSize: FONT.sm, color: COLORS.red, marginBottom: SPACING.sm,
    backgroundColor: COLORS.redDim, borderRadius: RADIUS.sm, padding: SPACING.sm,
  },

  confirmBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingVertical: 13, alignItems: 'center',
  },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT.base },
});
