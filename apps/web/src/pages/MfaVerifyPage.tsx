import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoWordmark } from '../components/Logo.js';
import { useAuthStore } from '../store/authStore.js';
import { translateMFAErrorMessage } from '../lib/supabase.js';
import FormFeedback from '../components/FormFeedback.js';

/**
 * Tela de verificação em duas etapas exibida após o login com e-mail e senha
 * quando o usuário tem 2FA ativo (sessão em aal1, aguardando step-up para aal2).
 */
export default function MfaVerifyPage() {
  const [code,    setCode]    = useState('');
  const [error,   setError]   = useState('');
  const navigate = useNavigate();

  const { verifyMfaChallenge, mfaPending, isLoading, logout } = useAuthStore((s) => ({
    verifyMfaChallenge: s.verifyMfaChallenge,
    mfaPending:         s.mfaPending,
    isLoading:          s.isLoading,
    logout:             s.logout,
  }));
  const [leaving, setLeaving] = useState(false);

  // Acesso direto à URL sem um login em andamento — volta para o login
  useEffect(() => {
    if (!mfaPending && !leaving) navigate('/login', { replace: true });
  }, [mfaPending, leaving, navigate]);

  const verify = async (value: string) => {
    if (!/^\d{6}$/.test(value)) {
      setError('Digite os 6 dígitos do código exibido no aplicativo autenticador.');
      return;
    }

    setError('');
    try {
      await verifyMfaChallenge(value);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? translateMFAErrorMessage(err.message) : 'Código inválido. Tente novamente.');
      setCode('');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void verify(code);
  };

  // Envia sozinho ao completar os 6 dígitos — um toque a menos
  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6 && !isLoading) void verify(digits);
  };

  // Saída para quem entrou na conta errada ou está sem o celular agora
  const handleUseAnotherAccount = async () => {
    setLeaving(true);
    await logout();
    navigate('/login', { replace: true });
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
              onChange={(e) => handleChange(e.target.value)}
              placeholder="000000"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-center text-2xl tracking-[0.5em] text-gray-900 outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>

          {error && <FormFeedback variant="error" message={error} />}

          <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">
            {isLoading ? 'Verificando...' : 'Confirmar'}
          </button>
        </form>

        <div className="mt-6 space-y-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sem acesso ao aplicativo autenticador? Peça ajuda ao suporte do ProdScore para recuperar a conta.
          </p>
          <button
            type="button"
            onClick={() => void handleUseAnotherAccount()}
            className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            Entrar com outra conta
          </button>
        </div>
      </div>
    </div>
  );
}
