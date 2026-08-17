import type { ReactNode } from 'react';
import { useAuthStore, requiresMFAVerification } from '../store/authStore.js';
import { LockClosedIcon } from './icons.js';

/**
 * Guard que exige nível de garantia aal2 (2FA verificado) para liberar `children`.
 *
 * Invariante do fluxo de login (ver authStore.login): uma sessão só chega a
 * isAuthenticated=true em aal1 quando o usuário NÃO tem nenhum fator TOTP
 * cadastrado — se houvesse um fator, o login teria exigido o step-up antes
 * de autenticar. Por isso, quando este guard bloqueia em aal1, a ação
 * correta é direcionar para a ativação do 2FA (não para uma tela de
 * verificação de um fator que ainda não existe).
 *
 * Use como bloco de conteúdo dentro de uma página (padrão usado aqui) ou
 * como elemento de rota, passando um `fallback` customizado (ex: <Navigate />).
 */
export default function RequireAAL2({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const needsVerification = useAuthStore(requiresMFAVerification);

  if (!needsVerification) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
      <LockClosedIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">Esta ação exige verificação em duas etapas.</p>
        <p className="mt-0.5 text-xs opacity-90">
          Ative o 2FA na seção acima e confirme o código do seu aplicativo autenticador para continuar.
        </p>
      </div>
    </div>
  );
}
