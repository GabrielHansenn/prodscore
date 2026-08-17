import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { MFAFactorStatus } from '@prodscore/shared';
import {
  enrollTOTP,
  verifyTOTPChallenge,
  unenrollTOTP,
  listTOTPFactors,
  translateMFAErrorMessage,
  type TOTPEnrollment,
} from '../lib/supabase.js';
import { ClipboardDocumentIcon, CheckCircleIcon } from './icons.js';

/** Estado do fluxo de ativação/gerenciamento do 2FA */
type Phase = 'checking' | 'active' | 'setup' | 'success' | 'error';

/**
 * Remove um eventual prefixo de data URI (ex: "data:image/svg+xml;utf-8,")
 * na frente do XML do SVG, mantendo só o markup puro.
 *
 * Defesa contra qualquer valor que chegue com esse prefixo grudado — o SVG
 * puro do Supabase nunca começa com "data:", então isso é sempre seguro.
 */
function stripDataUriPrefix(value: string): string {
  if (!value.startsWith('data:')) return value;
  const commaIndex = value.indexOf(',');
  return commaIndex === -1 ? value : value.slice(commaIndex + 1);
}

/**
 * Componente de ativação e gerenciamento de 2FA (TOTP) via Supabase Auth.
 *
 * Ao montar, verifica se já existe um fator TOTP verificado (listFactors) e:
 * - se existir, mostra o estado "ativo" com opção de desativar (unenroll);
 * - se não existir, chama enroll() uma única vez e exibe o QR code + campo
 *   de código para confirmar a ativação (challengeAndVerify).
 */
export default function EnrollMFA() {
  const [phase,       setPhase]       = useState<Phase>('checking');
  const [factorId,    setFactorId]    = useState<string | null>(null);
  const [enrollment,  setEnrollment]  = useState<TOTPEnrollment | null>(null);
  const [code,        setCode]        = useState('');
  const [error,       setError]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [copied,      setCopied]      = useState(false);

  /** Usado pelos disparos manuais (botão de retry, reativação após desativar) */
  const startEnrollment = useCallback(async () => {
    setError('');
    setCode('');
    setPhase('checking');

    const { data, error: enrollError } = await enrollTOTP();

    if (enrollError || !data) {
      setError('Não foi possível iniciar a ativação do 2FA. Tente novamente.');
      setPhase('error');
      return;
    }

    setFactorId(data.factorId);
    setEnrollment(data);
    setPhase('setup');
  }, []);

  useEffect(() => {
    // Flag de cancelamento (não useRef) — em React 18 StrictMode o efeito de
    // montagem roda, é limpo e roda de novo com uma instância nova do
    // componente, então um useRef não protegeria contra o enroll() duplicado.
    // Se o cleanup disparar antes do enroll() terminar, desfazemos o fator
    // não verificado criado à toa em vez de deixá-lo órfão na conta.
    let cancelled = false;

    void (async () => {
      const { factors } = await listTOTPFactors();
      if (cancelled) return;

      const activeFactor = factors.find((f) => f.status === MFAFactorStatus.Verified);
      if (activeFactor) {
        setFactorId(activeFactor.id);
        setPhase('active');
        return;
      }

      // Remove enrollments incompletos/abandonados (ex: de uma tentativa
      // anterior que não chegou a ser confirmada) — evita 422 por colisão
      // de nome amigável ao tentar criar um novo fator TOTP.
      const staleFactors = factors.filter((f) => f.status === MFAFactorStatus.Unverified);
      if (staleFactors.length > 0) {
        await Promise.all(staleFactors.map((f) => unenrollTOTP(f.id)));
        if (cancelled) return;
      }

      const { data, error: enrollError } = await enrollTOTP();

      if (cancelled) {
        if (data) void unenrollTOTP(data.factorId);
        return;
      }

      if (enrollError || !data) {
        // eslint-disable-next-line no-console
        console.error('[EnrollMFA] enrollTOTP falhou:', enrollError);
        setError('Não foi possível iniciar a ativação do 2FA. Tente novamente.');
        setPhase('error');
        return;
      }

      setFactorId(data.factorId);
      setEnrollment(data);
      setPhase('setup');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!factorId) return;

    if (!/^\d{6}$/.test(code)) {
      setError('Digite os 6 dígitos do código exibido no aplicativo autenticador.');
      return;
    }

    setError('');
    setSubmitting(true);

    // Não usamos listFactors() para confirmar sucesso aqui — o retorno de
    // verify (via challengeAndVerify) já indica se o código foi aceito.
    const { error: verifyError } = await verifyTOTPChallenge(factorId, code);

    setSubmitting(false);

    if (verifyError) {
      setError(translateMFAErrorMessage(verifyError));
      return;
    }

    setPhase('success');
  };

  const handleDisable = async () => {
    if (!factorId) return;
    setError('');
    setSubmitting(true);

    const { error: unenrollError } = await unenrollTOTP(factorId);

    setSubmitting(false);

    if (unenrollError) {
      setError('Não foi possível desativar o 2FA. Tente novamente.');
      return;
    }

    setFactorId(null);
    await startEnrollment();
  };

  const handleCopySecret = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível (ex: contexto não seguro) — ignora silenciosamente
    }
  };

  // -------------------------------------------------------------------------
  // Renderização
  // -------------------------------------------------------------------------

  if (phase === 'checking') {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
      </div>
    );
  }

  if (phase === 'active') {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-900/20">
          <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          <div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Autenticação de dois fatores ativa
            </p>
            <p className="mt-0.5 text-xs text-green-600/80 dark:text-green-400/70">
              Sua conta está protegida por um aplicativo autenticador.
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleDisable()}
          disabled={submitting}
          className="mt-4 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60 dark:text-red-400"
        >
          {submitting ? 'Desativando...' : 'Desativar 2FA'}
        </button>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
        <button type="button" onClick={() => void startEnrollment()} className="btn-secondary mt-4">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-900/20">
        <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
        <div>
          <p className="text-sm font-medium text-green-700 dark:text-green-400">2FA ativado com sucesso!</p>
          <p className="mt-0.5 text-xs text-green-600/80 dark:text-green-400/70">
            A partir de agora, você vai precisar do código do autenticador para entrar.
          </p>
        </div>
      </div>
    );
  }

  // phase === 'setup'
  return (
    <div>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Escaneie o QR code abaixo com um aplicativo autenticador (Google Authenticator, Authy, 1Password, etc.)
        e digite o código gerado para confirmar a ativação.
      </p>

      {enrollment && (
        <div className="mb-4 flex justify-center rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700">
          {/* SVG injetado diretamente no DOM — evita problemas de data URI/cache
              do navegador. Conteúdo vem do Supabase (não é entrada do usuário),
              então não há risco de XSS aqui. */}
          <div
            role="img"
            aria-label="QR code para ativação do 2FA"
            className="[&>svg]:h-40 [&>svg]:w-40"
            dangerouslySetInnerHTML={{ __html: stripDataUriPrefix(enrollment.qrCodeSvg) }}
          />
        </div>
      )}

      {enrollment && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
            Não conseguiu escanear? Digite o código manualmente:
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
            <code className="flex-1 truncate text-xs text-gray-700 dark:text-gray-300">{enrollment.secret}</code>
            <button
              type="button"
              onClick={() => void handleCopySecret()}
              aria-label="Copiar segredo"
              className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <ClipboardDocumentIcon className="h-4 w-4" />
            </button>
          </div>
          {copied && <p className="mt-1 text-xs text-green-600 dark:text-green-400">Copiado!</p>}
        </div>
      )}

      <form onSubmit={(e) => void handleConfirm(e)} className="space-y-3">
        <div>
          <label htmlFor="mfa-code" className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Código de 6 dígitos
          </label>
          <input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-center text-lg tracking-[0.5em] text-gray-900 outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Confirmando...' : 'Ativar'}
        </button>
      </form>
    </div>
  );
}
