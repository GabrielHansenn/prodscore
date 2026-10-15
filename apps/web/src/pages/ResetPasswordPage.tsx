import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AssuranceLevel, MFAFactorStatus, validatePassword, validatePasswordConfirmation } from '@prodscore/shared';
import { LogoWordmark } from '../components/Logo.js';
import FormFeedback, { FieldError } from '../components/FormFeedback.js';
import {
  supabase, signOut, getAssuranceLevel, listTOTPFactors, verifyTOTPChallenge, translateMFAErrorMessage,
} from '../lib/supabase.js';
import { useAuthStore } from '../store/authStore.js';
import Spinner from '../components/Spinner.js';

type Stage = 'checking' | 'ready' | 'invalid';

/** O link do e-mail traz o erro no hash quando expirou ou já foi usado */
function linkErrorFromHash(): boolean {
  return /(^|[#&])error(_code)?=/.test(window.location.hash);
}

/**
 * Página aberta pelo link do e-mail de "Esqueci minha senha".
 *
 * O supabase-js lê o token do link (detectSessionInUrl) e abre uma sessão de
 * recuperação. Aqui o usuário define a nova senha; se a conta tem 2FA, o
 * Supabase só aceita a troca depois do código do autenticador. No fim a
 * sessão de recuperação é encerrada e a pessoa entra com a senha nova.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);

  const [stage,     setStage]     = useState<Stage>('checking');
  const [factorId,  setFactorId]  = useState<string | null>(null);
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [code,      setCode]      = useState('');
  const [errors,    setErrors]    = useState<{ password?: string | undefined; confirm?: string | undefined; code?: string | undefined }>({});
  const [error,     setError]     = useState('');
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (linkErrorFromHash()) { setStage('invalid'); return undefined; }

    let settled = false;
    const prepare = async () => {
      if (settled) return;
      settled = true;
      // Conta com 2FA: a sessão de recuperação é aal1 e precisa subir para aal2
      const { currentLevel, nextLevel } = await getAssuranceLevel();
      if (currentLevel === AssuranceLevel.AAL1 && nextLevel === AssuranceLevel.AAL2) {
        const { factors } = await listTOTPFactors();
        setFactorId(factors.find((f) => f.status === MFAFactorStatus.Verified)?.id ?? null);
      }
      setStage('ready');
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) void prepare();
    });
    // getSession espera o supabase-js terminar de ler o link
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void prepare();
      else if (!settled) setStage('invalid');
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      password: validatePassword(password) ?? undefined,
      confirm:  validatePasswordConfirmation(password, confirm) ?? undefined,
      code:     factorId && !/^\d{6}$/.test(code) ? 'Digite os 6 dígitos do aplicativo autenticador.' : undefined,
    };
    setErrors(next);
    if (next.password || next.confirm || next.code) return;

    setError('');
    setSaving(true);
    try {
      if (factorId) {
        const { error: mfaError } = await verifyTOTPChallenge(factorId, code);
        if (mfaError) {
          setErrors({ code: translateMFAErrorMessage(mfaError) });
          return;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(/different from the old/i.test(updateError.message)
          ? 'A nova senha precisa ser diferente da atual.'
          : 'Não foi possível salvar a nova senha. Peça um novo link e tente de novo.');
        return;
      }

      // Encerra a sessão de recuperação: a pessoa entra com a senha nova
      await signOut();
      clearSession();
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <LogoWordmark variant="light" className="h-6 w-auto" />
        </div>

        {stage === 'checking' && (
          <div className="flex flex-col items-center gap-3 py-8" role="status">
            <Spinner size="md" />
            <p className="text-sm text-gray-500">Abrindo o link…</p>
          </div>
        )}

        {stage === 'invalid' && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Link expirado</h1>
            <p className="mt-3 text-sm text-gray-500">
              Este link de redefinição não vale mais: ele expira em 1 hora e só pode ser usado uma vez.
            </p>
            <Link to="/esqueci-senha" className="btn-primary mt-6 w-full">Pedir um novo link</Link>
          </div>
        )}

        {stage === 'ready' && (
          <>
            <h1 className="mb-1 text-2xl font-bold text-gray-900">Criar nova senha</h1>
            <p className="mb-8 text-sm text-gray-500">Use pelo menos 8 caracteres, com letras e números.</p>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
              <div>
                <label htmlFor="reset-password" className="mb-1.5 block text-xs font-medium text-gray-600">Nova senha</label>
                <input
                  id="reset-password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                  autoComplete="new-password"
                  autoFocus
                  aria-invalid={!!errors.password}
                  className={`input ${errors.password ? 'border-red-400' : ''}`}
                />
                <FieldError msg={errors.password} />
              </div>

              <div>
                <label htmlFor="reset-confirm" className="mb-1.5 block text-xs font-medium text-gray-600">Confirmar nova senha</label>
                <input
                  id="reset-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setErrors((p) => ({ ...p, confirm: undefined })); }}
                  autoComplete="new-password"
                  aria-invalid={!!errors.confirm}
                  className={`input ${errors.confirm ? 'border-red-400' : ''}`}
                />
                <FieldError msg={errors.confirm} />
              </div>

              {factorId && (
                <div>
                  <label htmlFor="reset-code" className="mb-1.5 block text-xs font-medium text-gray-600">
                    Código do aplicativo autenticador
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setErrors((p) => ({ ...p, code: undefined })); }}
                    placeholder="000000"
                    aria-invalid={!!errors.code}
                    className={`input text-center tracking-[0.4em] ${errors.code ? 'border-red-400' : ''}`}
                  />
                  <FieldError msg={errors.code} />
                  {!errors.code && (
                    <p className="mt-1 text-xs text-gray-400">Sua conta tem verificação em duas etapas.</p>
                  )}
                </div>
              )}

              {error && <FormFeedback variant="error" message={error} />}

              <button type="submit" disabled={saving} className="btn-primary w-full py-3">
                {saving ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
