import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { validateEmail } from '@prodscore/shared';
import { LogoWordmark } from '../components/Logo.js';
import FormFeedback, { FieldError } from '../components/FormFeedback.js';
import Spinner from '../components/Spinner.js';
import { CheckCircleIcon, ExclamationTriangleIcon } from '../components/icons.js';
import { supabase, signOut } from '../lib/supabase.js';
import { getFriendlyErrorMessage } from '../lib/errors.js';
import { useAuthStore } from '../store/authStore.js';

type Stage = 'checking' | 'confirmed' | 'invalid';

/**
 * Erro que o Supabase devolve no link quando ele expirou ou já foi usado.
 * Vem no hash (#error_code=otp_expired…) no fluxo implícito ou na query
 * (?error=…) no fluxo PKCE — confere os dois.
 */
function linkError(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query  = new URLSearchParams(window.location.search);
  return params.get('error_code') ?? params.get('error') ?? query.get('error_code') ?? query.get('error');
}

/**
 * Página aberta pelo link do e-mail de confirmação de cadastro.
 *
 * O supabase-js lê o token do link (detectSessionInUrl) e confirma o e-mail,
 * abrindo uma sessão. A página mostra o resultado e encerra essa sessão: a
 * pessoa entra pelo login normal (que pede o código, se a conta tiver 2FA) —
 * mesmo padrão da redefinição de senha. Antes o link caía na landing sem
 * dizer se tinha dado certo.
 */
export default function EmailConfirmedPage() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);

  const [stage,     setStage]     = useState<Stage>('checking');
  const [email,     setEmail]     = useState('');
  const [emailErr,  setEmailErr]  = useState<string | undefined>();
  const [resendMsg, setResendMsg] = useState<{ variant: 'success' | 'error'; text: string } | null>(null);
  const [sending,   setSending]   = useState(false);

  useEffect(() => {
    if (linkError()) { setStage('invalid'); return undefined; }

    let settled = false;
    const confirm = async (confirmedEmail: string | undefined) => {
      if (settled) return;
      settled = true;
      setEmail(confirmedEmail ?? '');
      // Encerra a sessão aberta pelo link: o acesso é pelo login normal
      await signOut();
      clearSession();
      setStage('confirmed');
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) void confirm(session.user.email);
    });
    // getSession espera o supabase-js terminar de ler o link
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void confirm(data.session.user.email);
      else if (!settled) setStage('invalid');
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToLogin = () => {
    // Garante o estado limpo (o carregamento inicial da sessão pode ter
    // terminado depois do signOut) antes da tela de login
    clearSession();
    navigate('/login', { replace: true, state: { emailConfirmed: true, email } });
  };

  const handleResend = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email) ?? undefined;
    setEmailErr(err);
    if (err) return;

    setSending(true);
    setResendMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/email-confirmado` },
      });
      if (error) throw error;
      setResendMsg({ variant: 'success', text: 'Se houver um cadastro pendente para este e-mail, enviamos um novo link. Confira a caixa de entrada e o spam.' });
    } catch (err) {
      setResendMsg({ variant: 'error', text: getFriendlyErrorMessage(err, 'Não foi possível reenviar o e-mail. Tente novamente em alguns minutos.') });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <LogoWordmark className="h-6 w-auto" />
        </div>

        {stage === 'checking' && (
          <div className="flex flex-col items-center gap-3 py-8" role="status">
            <Spinner size="md" />
            <p className="text-sm text-gray-500">Confirmando seu e-mail…</p>
          </div>
        )}

        {stage === 'confirmed' && (
          <div className="text-center" role="status">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-100 dark:bg-lime-900/30">
              <CheckCircleIcon className="h-8 w-8 text-lime-600 dark:text-lime-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">E-mail confirmado!</h1>
            <p className="mt-3 text-sm text-gray-500">
              Sua conta{email ? <> (<strong className="text-gray-700 dark:text-gray-300">{email}</strong>)</> : ''} está ativa.
              Entre para começar a ganhar pontos.
            </p>
            <button type="button" onClick={goToLogin} className="btn-primary mt-6 w-full py-3">
              Entrar
            </button>
          </div>
        )}

        {stage === 'invalid' && (
          <div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
                <ExclamationTriangleIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Link expirado ou já usado</h1>
              <p className="mt-3 text-sm text-gray-500">
                O link de confirmação vale por tempo limitado e só pode ser usado uma vez.
                Se você já confirmou, é só entrar. Se não, peça um novo link.
              </p>
            </div>

            <form onSubmit={(e) => void handleResend(e)} className="mt-6 space-y-3" noValidate>
              <div>
                <label htmlFor="confirm-email" className="mb-1.5 block text-xs font-medium text-gray-600">E-mail do cadastro</label>
                <input
                  id="confirm-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailErr(undefined); }}
                  autoComplete="email"
                  placeholder="seu@email.com"
                  aria-invalid={!!emailErr}
                  className={`input ${emailErr ? 'border-red-400' : ''}`}
                />
                <FieldError msg={emailErr} />
              </div>
              {resendMsg && <FormFeedback variant={resendMsg.variant} message={resendMsg.text} />}
              <button type="submit" disabled={sending} className="btn-primary w-full py-3">
                {sending ? 'Enviando…' : 'Reenviar link de confirmação'}
              </button>
              <button type="button" onClick={goToLogin} className="btn-secondary w-full py-3">
                Já confirmei — entrar
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
