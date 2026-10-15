import { Link } from 'react-router-dom';
import { TrophyIcon, FlameIcon, FlagIcon, SparklesIcon } from '../components/icons.js';
import { LogoWordmark } from '../components/Logo.js';
import { useConsentStore } from '../store/consentStore.js';

export default function LandingPage() {
  const resetConsent = useConsentStore((s) => s.resetConsent);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Nav */}
      <nav className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-8 sm:py-4">
        <LogoWordmark variant="light" className="h-7 w-auto sm:h-8" />
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/login" className="btn-secondary text-sm">Entrar</Link>
          <Link to="/cadastro" className="btn-primary text-sm">Começar grátis</Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center sm:px-6 sm:py-20">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-medium text-brand-700">
          <SparklesIcon className="h-3.5 w-3.5" /> Plataforma de gamificação de produtividade
        </div>

        <h1 className="mx-auto max-w-2xl text-balance text-3xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl">
          Transforme suas tarefas em{' '}
          <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
            conquistas
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-lg text-base text-gray-500 sm:mt-6 sm:text-lg">
          Ganhe pontos, suba de nível, mantenha sequências e compita no ranking. ProdScore torna sua produtividade um jogo.
        </p>

        {/* Empilha no celular: lado a lado os dois botões não cabem em 375px */}
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
          <Link to="/cadastro" className="btn-primary px-6 py-3 text-base">
            Começar agora →
          </Link>
          <Link to="/login" className="btn-secondary px-6 py-3 text-base">
            Já tenho conta
          </Link>
        </div>

        {/* Feature cards */}
        <div className="mt-14 grid w-full max-w-3xl gap-4 sm:mt-20 sm:grid-cols-3 sm:gap-6">
          {[
            {
              icon: <TrophyIcon className="h-8 w-8 text-amber-500" />,
              title: 'Ranking',
              desc: 'Compita globalmente ou semanalmente com outros usuários',
            },
            {
              icon: <FlameIcon className="h-8 w-8 text-amber-500" />,
              title: 'Streaks',
              desc: 'Mantenha sequências diárias e ganhe bônus de produtividade',
            },
            {
              icon: <FlagIcon className="h-8 w-8 text-brand-500" />,
              title: 'Missões',
              desc: 'Participe de desafios em grupo e desbloqueie conquistas especiais',
            },
          ].map((item) => (
            <div key={item.title} className="card p-6 text-center">
              <div className="mb-3 flex justify-center">{item.icon}</div>
              <h3 className="font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-200 px-4 py-5 text-center text-xs text-gray-400 sm:px-8">
        © {new Date().getFullYear()} ProdScore — Plataforma de gamificação de produtividade
        {' · '}
        <Link to="/politica-de-privacidade" className="underline hover:text-gray-600">
          Política de Privacidade
        </Link>
        {' · '}
        <button type="button" onClick={resetConsent} className="underline hover:text-gray-600">
          Configurações de cookies
        </button>
      </footer>
    </div>
  );
}
