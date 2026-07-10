import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { supabase } from '../lib/supabase.js';
import { BoltIcon, ArrowTrendingUpIcon, UsersIcon } from '../components/icons.js';
import { LogoWordmark } from '../components/Logo.js';

// ---------------------------------------------------------------------------
// Ícones locais
// ---------------------------------------------------------------------------
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
function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers de validação
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASS_HAS_LETTER  = /[a-zA-Z]/;
const PASS_HAS_NUMBER  = /[0-9]/;

interface FieldErrors {
  username?:       string;
  email?:          string;
  password?:       string;
  confirmPassword?: string;
}

function validateFields(
  username: string,
  email: string,
  password: string,
  confirmPassword: string,
): FieldErrors {
  const errs: FieldErrors = {};

  if (!username.trim())
    errs.username = 'Nome de usuário é obrigatório.';
  else if (!/^[a-zA-Z0-9_]{3,30}$/.test(username))
    errs.username = 'Use 3–30 caracteres: letras, números ou _.';

  if (!email.trim())
    errs.email = 'E-mail é obrigatório.';
  else if (!EMAIL_RE.test(email))
    errs.email = 'Informe um e-mail válido (ex: nome@dominio.com).';

  if (!password)
    errs.password = 'Senha é obrigatória.';
  else if (password.length < 8)
    errs.password = 'A senha precisa ter pelo menos 8 caracteres.';
  else if (!PASS_HAS_LETTER.test(password))
    errs.password = 'A senha precisa conter pelo menos uma letra.';
  else if (!PASS_HAS_NUMBER.test(password))
    errs.password = 'A senha precisa conter pelo menos um número.';

  if (!confirmPassword)
    errs.confirmPassword = 'Confirme sua senha.';
  else if (password && confirmPassword !== password)
    errs.confirmPassword = 'As senhas não coincidem.';

  return errs;
}

function mapSupabaseError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes('user already registered') || msg.includes('already registered') || msg.includes('already been registered'))
    return 'Este e-mail já possui uma conta. Tente fazer login.';
  if (msg.includes('invalid email') || msg.includes('unable to validate email'))
    return 'Endereço de e-mail inválido.';
  if (msg.includes('password should be at least') || msg.includes('password is too short'))
    return 'A senha deve ter no mínimo 8 caracteres.';
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('email rate limit'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (msg.includes('signup is disabled') || msg.includes('signups not allowed'))
    return 'Cadastros estão temporariamente desativados. Tente mais tarde.';
  return 'Erro ao criar conta. Tente novamente mais tarde.';
}

// ---------------------------------------------------------------------------
// Hero lateral (compartilhado entre os dois passos)
// ---------------------------------------------------------------------------
function HeroPanel() {
  return (
    <div className="hidden flex-col justify-between bg-sidebar-bg p-10 lg:flex lg:w-5/12 xl:w-2/5">
      <LogoWordmark variant="dark" className="h-8 w-auto" />

      <div>
        <h2 className="text-3xl font-bold leading-tight text-white">
          Comece sua jornada<br />de produtividade
        </h2>
        <p className="mt-4 text-sidebar-text">
          Crie sua conta gratuitamente e comece a ganhar pontos por cada tarefa concluída.
        </p>
        <div className="mt-8 space-y-3">
          {[
            { icon: <BoltIcon            className="h-4 w-4" />, text: 'Pontos por cada tarefa completada' },
            { icon: <ArrowTrendingUpIcon className="h-4 w-4" />, text: 'Evolução de nível e XP' },
            { icon: <UsersIcon           className="h-4 w-4" />, text: 'Grupos e competição com amigos' },
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
  );
}

// ---------------------------------------------------------------------------
// Tela de confirmação de e-mail
// ---------------------------------------------------------------------------
function EmailConfirmStep({ email }: { email: string }) {
  const [status,    setStatus]    = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [countdown, setCountdown] = useState(0);

  const handleResend = async () => {
    setStatus('sending');
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) {
      setStatus('error');
      return;
    }
    setStatus('sent');
    // cooldown de 60s para evitar spam
    let secs = 60;
    setCountdown(secs);
    const interval = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0) {
        clearInterval(interval);
        setStatus('idle');
        setCountdown(0);
      }
    }, 1000);
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-sm text-center">
        {/* Ícone */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100">
          <MailIcon className="h-8 w-8 text-brand-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Verifique seu e-mail</h1>
        <p className="mt-3 text-sm text-gray-500">
          Enviamos um link de confirmação para:
        </p>
        <p className="mt-1 font-semibold text-gray-800 break-all">{email}</p>

        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-700 text-left space-y-1">
          <p className="font-medium">O que fazer agora:</p>
          <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-blue-600">
            <li>Abra seu e-mail e procure uma mensagem do ProdScore</li>
            <li>Clique no botão de confirmação</li>
            <li>Você será redirecionado para fazer login</li>
          </ol>
          <p className="mt-2 text-xs text-blue-500">
            Não encontrou? Verifique a pasta de spam ou lixo eletrônico.
          </p>
        </div>

        {/* Botão reenviar */}
        <div className="mt-6">
          {status === 'sent' ? (
            <p className="text-sm font-medium text-green-600">
              E-mail reenviado! Aguarde {countdown}s para reenviar novamente.
            </p>
          ) : status === 'error' ? (
            <p className="text-sm text-red-600">
              Não foi possível reenviar. Tente novamente em instantes.
            </p>
          ) : (
            <button
              onClick={() => void handleResend()}
              disabled={status === 'sending' || countdown > 0}
              className="btn-secondary w-full"
            >
              {status === 'sending'
                ? 'Reenviando...'
                : countdown > 0
                  ? `Reenviar em ${countdown}s`
                  : 'Reenviar e-mail de confirmação'
              }
            </button>
          )}
        </div>

        <div className="mt-6 border-t border-gray-100 pt-6">
          <Link to="/login" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Já confirmei meu e-mail — Fazer login →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente de erro por campo
// ---------------------------------------------------------------------------
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 text-xs text-red-600" role="alert">
      {msg}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function RegisterPage() {
  const [username,        setUsername]        = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [fieldErrors,     setFieldErrors]     = useState<FieldErrors>({});
  const [globalError,     setGlobalError]     = useState('');
  const [step,            setStep]            = useState<'form' | 'confirm'>('form');

  const { register, isLoading } = useAuthStore((s) => ({ register: s.register, isLoading: s.isLoading }));

  const inputClass = (field: keyof FieldErrors) =>
    `w-full rounded-xl border bg-white px-3 py-2.5 pr-11 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all
     focus:ring-2 ${
       fieldErrors[field]
         ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
         : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500/20'
     }`;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGlobalError('');

    const errs = validateFields(username, email, password, confirmPassword);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      // foca no primeiro campo com erro
      const firstField = Object.keys(errs)[0] as string;
      document.getElementById(firstField)?.focus();
      return;
    }
    setFieldErrors({});

    try {
      await register(username.trim(), email.trim(), password);
      // cadastro sem confirmação de e-mail → vai para o dashboard via authStore
    } catch (err) {
      if (err instanceof Error && err.message === 'CONFIRM_EMAIL') {
        setStep('confirm');
        return;
      }
      setGlobalError(err instanceof Error ? mapSupabaseError(err.message) : 'Erro inesperado. Tente novamente.');
    }
  };

  return (
    <div className="flex min-h-screen">
      <HeroPanel />

      {step === 'confirm' ? (
        <EmailConfirmStep email={email} />
      ) : (
        <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-12">
          <div className="w-full max-w-sm">
            {/* Logo mobile */}
            <div className="mb-8 lg:hidden">
              <LogoWordmark variant="light" className="h-6 w-auto" />
            </div>

            <h1 className="mb-1 text-2xl font-bold text-gray-900">Criar conta</h1>
            <p className="mb-8 text-sm text-gray-500">É gratuito e leva menos de 1 minuto</p>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>

              {/* Nome de usuário */}
              <div>
                <label htmlFor="username" className="mb-1.5 block text-xs font-medium text-gray-600">
                  Nome de usuário <span className="text-red-500">*</span>
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (fieldErrors.username) setFieldErrors((p) => ({ ...p, username: undefined }));
                  }}
                  placeholder="seunome123"
                  autoComplete="username"
                  aria-invalid={!!fieldErrors.username}
                  aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                  className={inputClass('username').replace('pr-11', 'pr-3')}
                />
                <FieldError msg={fieldErrors.username} />
                {!fieldErrors.username && (
                  <p className="mt-1 text-xs text-gray-400">Letras, números e _ (3–30 caracteres)</p>
                )}
              </div>

              {/* E-mail */}
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-gray-600">
                  E-mail <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
                  }}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  inputMode="email"
                  aria-invalid={!!fieldErrors.email}
                  className={inputClass('email').replace('pr-11', 'pr-3')}
                />
                <FieldError msg={fieldErrors.email} />
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-gray-600">
                  Senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
                    }}
                    placeholder="Mín. 8 caracteres com letras e números"
                    autoComplete="new-password"
                    aria-invalid={!!fieldErrors.password}
                    className={inputClass('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-0 top-0 flex h-full min-w-[44px] items-center justify-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password
                  ? <FieldError msg={fieldErrors.password} />
                  : <p className="mt-1 text-xs text-gray-400">Mínimo 8 caracteres, com letras e números</p>
                }
              </div>

              {/* Confirmar senha */}
              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-medium text-gray-600">
                  Confirmar senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
                    }}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    aria-invalid={!!fieldErrors.confirmPassword}
                    className={inputClass('confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                    className="absolute right-0 top-0 flex h-full min-w-[44px] items-center justify-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
                <FieldError msg={fieldErrors.confirmPassword} />
              </div>

              {/* Erro global (Supabase) */}
              {globalError && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                  {globalError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3"
              >
                {isLoading ? 'Criando conta...' : 'Criar conta'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Já tem conta?{' '}
              <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
                Entre aqui
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
