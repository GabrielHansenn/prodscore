import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoWordmark } from '../components/Logo.js';
import { useAuthStore } from '../store/authStore.js';
import { translateMFAErrorMessage } from '../lib/supabase.js';

/**
 * Tela de verificação em duas etapas exibida após o login com e-mail e senha
 * quando o usuário tem 2FA ativo (sessão em aal1, aguardando step-up para aal2).
 */
export default function MfaVerifyPage() {
  const [code,    setCode]    = useState('');
  const [error,   setError]   = useState('');
  const navigate = useNavigate();

  const { verifyMfaChallenge, mfaPending, isLoading } = useAuthStore((s) => ({
    verifyMfaChallenge: s.verifyMfaChallenge,
    mfaPending:         s.mfaPending,
    isLoading:          s.isLoading,
  }));

  // Acesso direto à URL sem um login em andamento — volta para o login
  useEffect(() => {
    if (!mfaPending) navigate('/login', { replace: true });
  }, [mfaPending, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(code)) {
      setError('Digite os 6 dígitos do código exibido no aplicativo autenticador.');
      return;
    }

    setError('');
    try {
      await verifyMfaChallenge(code);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? translateMFAErrorMessage(err.message) : 'Código inválido. Tente novamente.');
    }
  };

  if (!mfaPending) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <LogoWordmark variant="light" className="h-6 w-auto" />
        </div>

        <h1 className="mb-1 text-center text-2xl font-bold text-gray-900 dark:text-white">
          Verificação em duas etapas
        </h1>
        <p className="mb-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor="mfa-verify-code" className="sr-only">
              Código de verificação
            </label>
            <input
              id="mfa-verify-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-center text-2xl tracking-[0.5em] text-gray-900 outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}

          <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">
            {isLoading ? 'Verificando...' : 'Confirmar'}
          </button>
        </form>
      </div>
    </div>
  );
}
