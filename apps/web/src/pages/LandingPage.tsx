import { Link } from 'react-router-dom';
import { TrophyIcon, FlameIcon, FlagIcon, SparklesIcon } from '../components/icons.js';
import { LogoWordmark } from '../components/Logo.js';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
        <LogoWordmark variant="light" className="h-8 w-auto" />
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-secondary text-sm">Entrar</Link>
          <Link to="/cadastro" className="btn-primary text-sm">Começar grátis</Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-medium text-brand-700">
          <SparklesIcon className="h-3.5 w-3.5" /> Plataforma de gamificação de produtividade
        </div>

        <h1 className="mx-auto max-w-2xl text-5xl font-bold leading-tight tracking-tight text-gray-900">
          Transforme suas tarefas em{' '}
          <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
            conquistas
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-lg text-lg text-gray-500">
          Ganhe pontos, suba de nível, mantenha sequências e compita no ranking. ProdScore torna sua produtividade um jogo.
        </p>

        <div className="mt-8 flex gap-4">
          <Link to="/cadastro" className="btn-primary px-6 py-3 text-base">
            Começar agora →
          </Link>
          <Link to="/login" className="btn-secondary px-6 py-3 text-base">
            Já tenho conta
          </Link>
        </div>

        {/* Feature cards */}
        <div className="mt-20 grid max-w-3xl gap-6 sm:grid-cols-3">
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

      <footer className="border-t border-gray-200 px-8 py-5 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} ProdScore — Plataforma de gamificação de produtividade
      </footer>
    </div>
  );
}
