import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogoWordmark } from '../components/Logo.js';
import { useAuthStore } from '../store/authStore.js';
import { supabase } from '../lib/supabase.js';
import { TrophyIcon, FlameIcon, FlagIcon } from '../components/icons.js';

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeSlashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

export default function LoginPage() {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const { login, isLoading } = useAuthStore((s) => ({ login: s.login, isLoading: s.isLoading }));
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedsConfirm(false);

    if (!email.trim() || !password) {
      setError('Preencha o e-mail e a senha.');
      return;
    }

    try {
      await login(email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('email not confirmed') || msg.toLowerCase().includes('not confirmed')) {
        setNeedsConfirm(true);
      } else {
        setError(msg || 'Erro ao fazer login. Tente novamente.');
      }
    }
  };

  const handleResend = async () => {
    setResendStatus('sending');
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    setResendStatus(resendError ? 'idle' : 'sent');
    if (resendError) setError('Não foi possível reenviar o e-mail. Tente novamente.');
  };

  return (
    <div className="flex min-h-screen">
      {/* Hero lateral */}
      <div className="hidden flex-col justify-between bg-sidebar-bg p-10 lg:flex lg:w-5/12 xl:w-2/5">
        <LogoWordmark variant="dark" className="h-8 w-auto" />

        <div>
          <h2 className="text-3xl font-bold leading-tight text-white">
            Transforme tarefas<br />em conquistas
          </h2>
          <p className="mt-4 text-sidebar-text">
            Gamifique sua produtividade. Ganhe pontos, suba de nível e compita com seus amigos enquanto completa suas tarefas.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: <TrophyIcon className="h-4 w-4" />, text: 'Ranking global e semanal' },
              { icon: <FlameIcon  className="h-4 w-4" />, text: 'Sequências de produtividade' },
              { icon: <FlagIcon   className="h-4 w-4" />, text: 'Missões em grupo' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-sm text-sidebar-text">
                <span className="shrink-0">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-sidebar-muted">
          © {new Date().getFullYear()} ProdScore — Plataforma de gamificação
        </p>
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <LogoWordmark variant="light" className="h-6 w-auto" />
          </div>

          <h1 className="mb-1 text-2xl font-bold text-gray-900">Bem-vindo de volta</h1>
          <p className="mb-8 text-sm text-gray-500">Entre com sua conta para continuar</p>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-gray-600">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-gray-600">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 pr-11 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-0 top-0 flex h-full min-w-[44px] items-center justify-center px-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword
                    ? <EyeSlashIcon className="h-4 w-4" />
                    : <EyeIcon      className="h-4 w-4" />
                  }
                </button>
              </div>
            </div>

            {/* E-mail não confirmado */}
            {needsConfirm && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <p className="font-semibold">Confirme seu e-mail antes de entrar.</p>
                <p className="mt-1 text-xs text-amber-600">
                  Enviamos um link para <strong>{email}</strong>. Verifique sua caixa de entrada.
                </p>
                {resendStatus !== 'sent' ? (
                  <button
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={resendStatus === 'sending'}
                    className="mt-2 text-xs font-semibold underline hover:text-amber-800 disabled:opacity-50"
                  >
                    {resendStatus === 'sending' ? 'Enviando...' : 'Reenviar e-mail de confirmação'}
                  </button>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-green-600">✓ E-mail reenviado!</p>
                )}
              </div>
            )}

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Não tem conta?{' '}
            <Link to="/cadastro" className="font-medium text-brand-600 hover:text-brand-700">
              Cadastre-se grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
