import type { RichTextDoc, RichTextBlock, RichTextListItem, RichTextMark, RichTextText } from '@prodscore/shared';

/**
 * Converte o texto do compositor mobile para o mesmo documento de texto rico
 * usado pelo editor do web.
 *
 * O mobile não tem um WYSIWYG equivalente ao Tiptap sem WebView, então a
 * composição usa marcação leve (a barra de atalhos envolve a seleção):
 *   **negrito**  *itálico*  __sublinhado__  ~~tachado~~  `código`
 *   linhas iniciadas por "- " viram lista com marcadores
 *   linhas iniciadas por "1. " viram lista numerada
 *
 * O resultado é o mesmo formato que o backend valida — a renderização fica
 * idêntica nas duas plataformas.
 */

interface InlineRule {
  mark: RichTextMark;
  regex: RegExp;
}

// Ordem importa: ** antes de *, senão "**x**" casaria como itálico duplo
const INLINE_RULES: InlineRule[] = [
  { mark: 'bold',      regex: /\*\*([^*]+)\*\*/ },
  { mark: 'underline', regex: /__([^_]+)__/ },
  { mark: 'strike',    regex: /~~([^~]+)~~/ },
  { mark: 'code',      regex: /`([^`]+)`/ },
  { mark: 'italic',    regex: /\*([^*]+)\*/ },
];

/** Divide uma linha em trechos com as marcas aplicadas. */
function parseInline(line: string, inherited: RichTextMark[] = []): RichTextText[] {
  for (const rule of INLINE_RULES) {
    const match = rule.regex.exec(line);
    if (!match || match.index === undefined) continue;

    const before = line.slice(0, match.index);
    const inner  = match[1] ?? '';
    const after  = line.slice(match.index + match[0].length);

    return [
      ...(before ? parseInline(before, inherited) : []),
      ...parseInline(inner, [...inherited, rule.mark]),
      ...(after ? parseInline(after, inherited) : []),
    ];
  }

  if (line.length === 0) return [];
  return [inherited.length > 0 ? { type: 'text', text: line, marks: [...inherited] } : { type: 'text', text: line }];
}

function paragraphFrom(line: string) {
  const content = parseInline(line);
  return content.length > 0 ? { type: 'paragraph' as const, content } : { type: 'paragraph' as const };
}

/** Converte o texto do compositor num documento; `null` se não houver conteúdo. */
export function markdownToRichText(input: string): RichTextDoc | null {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const blocks: RichTextBlock[] = [];

  let listType: 'bulletList' | 'orderedList' | null = null;
  let listItems: RichTextListItem[] = [];

  const flushList = () => {
    if (listType && listItems.length > 0) blocks.push({ type: listType, content: listItems });
    listType = null;
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const bullet  = /^\s*[-*]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+\.\s+(.*)$/.exec(line);

    if (bullet || ordered) {
      const type: 'bulletList' | 'orderedList' = bullet ? 'bulletList' : 'orderedList';
      const text = (bullet ?? ordered)![1] ?? '';
      if (listType !== type) flushList();
      listType = type;
      listItems.push({ type: 'listItem', content: [paragraphFrom(text)] });
      continue;
    }

    flushList();
    if (line.trim().length > 0) blocks.push(paragraphFrom(line));
  }

  flushList();

  return blocks.length > 0 ? { type: 'doc', content: blocks } : null;
}

/**
 * Aplica (ou remove) uma marcação em torno da seleção — usado pelos botões da
 * barra do compositor. Se não há seleção, insere os delimitadores e deixa o
 * cursor no meio.
 */
export function toggleWrap(
  text: string,
  selection: { start: number; end: number },
  wrapper: string,
): { text: string; selection: { start: number; end: number } } {
  const { start, end } = selection;
  const selected = text.slice(start, end);
  const len = wrapper.length;

  // Já está marcado? então desmarca
  const alreadyWrapped =
    text.slice(Math.max(0, start - len), start) === wrapper &&
    text.slice(end, end + len) === wrapper;

  if (alreadyWrapped) {
    const next = text.slice(0, start - len) + selected + text.slice(end + len);
    return { text: next, selection: { start: start - len, end: end - len } };
  }

  const next = text.slice(0, start) + wrapper + selected + wrapper + text.slice(end);
  return {
    text: next,
    selection: { start: start + len, end: end + len },
  };
}

/** Prefixa as linhas da seleção com "- " ou "1. " (alterna se já estiverem prefixadas). */
export function toggleListPrefix(
  text: string,
  selection: { start: number; end: number },
  kind: 'bullet' | 'ordered',
): { text: string; selection: { start: number; end: number } } {
  const lineStart = text.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
  const lineEndRaw = text.indexOf('\n', selection.end);
  const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;

  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n');

  const prefixOf = (i: number) => (kind === 'bullet' ? '- ' : `${i + 1}. `);
  const alreadyPrefixed = lines.every((l, i) => l.startsWith(prefixOf(i)));

  const nextLines = lines.map((l, i) =>
    alreadyPrefixed ? l.slice(prefixOf(i).length) : `${prefixOf(i)}${l}`,
  );

  const nextBlock = nextLines.join('\n');
  const next = text.slice(0, lineStart) + nextBlock + text.slice(lineEnd);
  const delta = nextBlock.length - block.length;

  return { text: next, selection: { start: selection.start, end: selection.end + delta } };
}
