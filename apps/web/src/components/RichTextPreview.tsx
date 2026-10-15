import { useLayoutEffect, useRef, useState } from 'react';
import type { RichTextDoc } from '@prodscore/shared';
import RichText from './RichText.js';

interface RichTextPreviewProps {
  doc: RichTextDoc;
  /** Abre a descrição completa (modal de detalhe da tarefa, tela do grupo...) */
  onShowMore: () => void;
  /** Altura máxima da prévia — o padrão equivale a ~3 linhas de texto pequeno */
  maxHeightClassName?: string;
  className?: string;
}

/**
 * Prévia da descrição formatada para cards e listas (tarefas e grupos).
 *
 * `line-clamp` só funciona num único bloco de texto, e a descrição pode ter
 * vários parágrafos e listas — então a prévia limita a ALTURA e mede se o
 * conteúdo passou dela. Só nesse caso aparece o "ver mais" (com um esmaecido
 * na borda indicando que o texto continua).
 */
export default function RichTextPreview({
  doc, onShowMore, maxHeightClassName = 'max-h-[3.75rem]', className,
}: RichTextPreviewProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;

    const measure = () => setOverflowing(box.scrollHeight > box.clientHeight + 1);
    measure();

    // A largura do card muda com a janela — remede quando o tamanho mudar
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [doc]);

  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      {/* Máscara em vez de gradiente colorido: esmaece sobre qualquer fundo
          (o .card escuro usa gradiente próprio) */}
      <div
        ref={boxRef}
        className={`overflow-hidden ${maxHeightClassName} ${
          overflowing ? '[mask-image:linear-gradient(to_bottom,black_60%,transparent)]' : ''
        }`}
      >
        <RichText doc={doc} className="text-xs leading-5 text-gray-500 dark:text-gray-400" />
      </div>
      {overflowing && (
        <button
          type="button"
          // Não propaga: o card em volta pode ter o próprio clique (ex: card de grupo)
          onClick={(e) => { e.stopPropagation(); onShowMore(); }}
          className="mt-0.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          ver mais
        </button>
      )}
    </div>
  );
}
