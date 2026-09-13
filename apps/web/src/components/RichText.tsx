import type { RichTextDoc, RichTextMark, RichTextText } from '@prodscore/shared';

/**
 * Renderiza um documento de texto rico.
 *
 * Percorre a árvore JSON e monta elementos React conhecidos — não existe
 * `dangerouslySetInnerHTML` em nenhum ponto, então nada que venha do banco
 * pode injetar markup. O espelho em React Native é
 * apps/mobile/src/components/RichText.tsx.
 */

const MARK_CLASS: Record<RichTextMark, string> = {
  bold:      'font-semibold',
  italic:    'italic',
  underline: 'underline',
  strike:    'line-through',
  code:      'rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/10',
};

function TextRun({ node }: { node: RichTextText }) {
  const className = (node.marks ?? []).map((m) => MARK_CLASS[m]).join(' ');
  if (node.marks?.includes('code')) {
    return <code className={className}>{node.text}</code>;
  }
  return className ? <span className={className}>{node.text}</span> : <>{node.text}</>;
}

export default function RichText({ doc, className }: { doc: RichTextDoc; className?: string }) {
  return (
    <div className={`space-y-1 whitespace-pre-wrap break-words ${className ?? ''}`}>
      {doc.content.map((block, i) => {
        if (block.type === 'paragraph') {
          return (
            <p key={i}>
              {(block.content ?? []).map((t, j) => <TextRun key={j} node={t} />)}
            </p>
          );
        }

        const items = block.content.map((item, j) => (
          <li key={j}>
            {item.content.map((p, k) => (
              <span key={k}>{(p.content ?? []).map((t, l) => <TextRun key={l} node={t} />)}</span>
            ))}
          </li>
        ));

        return block.type === 'bulletList'
          ? <ul key={i} className="list-disc space-y-0.5 pl-5">{items}</ul>
          : <ol key={i} className="list-decimal space-y-0.5 pl-5">{items}</ol>;
      })}
    </div>
  );
}
