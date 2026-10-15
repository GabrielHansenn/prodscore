import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { validateEmail } from '@prodscore/shared';
import { LogoWordmark } from '../components/Logo.js';
import FormFeedback, { FieldError } from '../components/FormFeedback.js';
import { api } from '../services/api.js';
import { getFriendlyErrorMessage } from '../lib/errors.js';

/**
 * "Esqueci minha senha": pede o e-mail e manda o link de redefinição
 * (POST /auth/forgot-password). A resposta é a mesma exista ou não a conta,
 * então a tela sempre mostra a confirmação depois de enviar.
 */
export default function ForgotPasswordPage() {
  const [email,      setEmail]      = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error,      setError]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [sent,       setSent]       = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) { setFieldError(emailError); return; }

    setFieldError('');
    setError('');
    setSending(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Não foi possível enviar o e-mail. Tente novamente.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <LogoWordmark variant="light" className="h-6 w-auto" />
        </div>

        {sent ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Confira seu e-mail</h1>
            <p className="mt-3 text-sm text-gray-500">
              Se existir uma conta com <strong className="break-all text-gray-700">{email.trim()}</strong>, enviamos
              um link para criar uma nova senha. O link vale por 1 hora.
            </p>
            <p className="mt-2 text-xs text-gray-400">Não chegou? Procure na pasta de spam ou envie de novo.</p>
            <div className="mt-6 flex flex-col gap-3">
              <button type="button" onClick={() => setSent(false)} className="btn-secondary w-full">
                Enviar de novo
              </button>
              <Link to="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Voltar para o login
              </Link>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mb-1 text-2xl font-bold text-gray-900">Esqueceu a senha?</h1>
            <p className="mb-8 text-sm text-gray-500">
              Digite o e-mail da sua conta e enviaremos um link para você criar uma nova senha.
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
              <div>
                <label htmlFor="forgot-email" className="mb-1.5 block text-xs font-medium text-gray-600">E-mail</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldError(''); }}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  autoFocus
                  aria-invalid={!!fieldError}
                  className={`input ${fieldError ? 'border-red-400' : ''}`}
                />
                <FieldError msg={fieldError} />
              </div>

              {error && <FormFeedback variant="error" message={error} />}

              <button type="submit" disabled={sending} className="btn-primary w-full py-3">
                {sending ? 'Enviando...' : 'Enviar link'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Lembrou a senha?{' '}
              <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">Entrar</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
