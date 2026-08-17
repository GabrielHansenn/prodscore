import { Link } from 'react-router-dom';
import { LogoWordmark } from '../components/Logo.js';
import { useConsentStore } from '../store/consentStore.js';

/**
 * Página de Política de Privacidade.
 *
 * Placeholder inicial em PT-BR — o conteúdo jurídico completo (bases legais
 * detalhadas, prazos de retenção, dados de contato do encarregado/DPO etc.)
 * deve ser revisado com jurídico antes de produção.
 */
export default function PrivacyPolicyPage() {
  const resetConsent = useConsentStore((s) => s.resetConsent);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
        <Link to="/">
          <LogoWordmark variant="light" className="h-8 w-auto" />
        </Link>
        <Link to="/" className="btn-secondary text-sm">Voltar ao início</Link>
      </nav>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Política de Privacidade</h1>
        <p className="mb-8 text-sm text-gray-400">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-600">
          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">1. Quais dados coletamos</h2>
            <p>
              Coletamos os dados que você fornece ao criar sua conta (e-mail, nome de usuário) e os dados
              gerados pelo uso da plataforma (tarefas, pontos, conquistas). Também usamos cookies para manter
              sua sessão ativa e, com o seu consentimento, para fins analíticos e de melhoria de produto.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">2. Cookies</h2>
            <p>
              Usamos cookies essenciais (sempre ativos, necessários para login e segurança) e, mediante seu
              consentimento explícito, cookies analíticos, funcionais e de marketing. Você pode revisar e
              alterar essa escolha a qualquer momento clicando em{' '}
              <button type="button" onClick={resetConsent} className="font-medium text-brand-600 underline hover:text-brand-700">
                "Configurações de cookies"
              </button>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">3. Seus direitos (LGPD)</h2>
            <p>
              Nos termos da Lei nº 13.709/2018 (LGPD), você pode solicitar a qualquer momento a confirmação,
              o acesso, a correção ou a eliminação dos seus dados pessoais, bem como revogar consentimentos
              previamente concedidos.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-gray-900">4. Contato</h2>
            <p>
              Dúvidas sobre esta política ou sobre o tratamento dos seus dados podem ser enviadas para o
              nosso canal de suporte.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-200 px-8 py-5 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} ProdScore — Plataforma de gamificação de produtividade
      </footer>
    </div>
  );
}
