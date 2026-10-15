import { Link, useLocation } from 'react-router-dom';
import { LogoWordmark } from '../components/Logo.js';
import { useAuthStore } from '../store/authStore.js';

/**
 * Endereço inexistente. Antes, qualquer link quebrado levava à landing sem
 * aviso — para quem estava logado, parecia que a sessão tinha caído.
 */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <LogoWordmark variant="light" className="h-6 w-auto" />
        </div>
        <p className="font-mono text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Página não encontrada</h1>
        <p className="mt-3 text-sm text-gray-500">
          O endereço <span className="break-all font-mono text-gray-700">{pathname}</span> não existe ou mudou de lugar.
        </p>
        <Link to={isAuthenticated ? '/dashboard' : '/'} className="btn-primary mt-6 w-full">
          {isAuthenticated ? 'Ir para o Início' : 'Ir para a página inicial'}
        </Link>
      </div>
    </div>
  );
}
