import { createPortal } from 'react-dom';
import { useEffect, useRef, type ReactNode } from 'react';
import { useScrollLock } from '../lib/useScrollLock.js';

interface ModalProps {
  /** Fecha o modal (Esc, clique fora). Omitir enquanto algo está sendo salvo, se não puder fechar. */
  onClose: () => void;
  /** id do título do modal — o leitor de tela anuncia o diálogo por ele */
  labelledBy: string;
  /** Classes do painel (largura, padding, cores) — o padrão é o cartão de formulário */
  className?: string;
  children: ReactNode;
}

const FOCUSABLE = 'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * Modal padrão do web: escurece o fundo, fecha com Esc ou clique fora,
 * é anunciado como diálogo e leva o foco para o primeiro campo. Antes cada
 * modal fazia isso do seu jeito (alguns não fechavam com Esc nem eram
 * reconhecidos pelo leitor de tela).
 */
export default function Modal({
  onClose, labelledBy, children,
  className = 'w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Sempre a versão mais recente de onClose, sem refazer o listener a cada render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useScrollLock();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // Devolve o foco para quem abriu o modal (ex: botão "Nova Tarefa")
      previouslyFocused?.focus?.();
    };
  }, []);

  // Portal no <body>: fora de cards com opacidade/animação, que deixavam o
  // popup transparente, preso atrás dos outros cards e permitiam abrir vários
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      // Fecha só no clique no fundo — não quando o clique começa dentro do painel
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseRef.current(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        // overscroll-contain: ao chegar no topo/fim do modal a rolagem para aqui
        className={`max-h-dialog overflow-y-auto overscroll-contain ${className}`}
      >
        {children}
      </div>
    </div>
  , document.body);
}
