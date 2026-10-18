import type { RichTextDoc, RichTextBlock, RichTextListItem, RichTextMark, RichTextText } from './richText.js';

/**
 * Conversão entre marcação leve (estilo Markdown) e o documento de texto rico.
 *
 * O mobile não tem um WYSIWYG equivalente ao Tiptap sem WebView, então a
 * composição usa marcação leve (a barra de atalhos envolve a seleção):
 *   **negrito**  *itálico*  ***negrito e itálico***
 *   __sublinhado__  ~~tachado~~  `código`
 *   linhas iniciadas por "• " (ou "- " / "* ") viram lista com marcadores
 *   linhas iniciadas por "1. " viram lista numerada
 *
 * O resultado é o mesmo formato que o backend valida — a renderização fica
 * idêntica nas duas plataformas. `richTextToMarkdown` faz o caminho inverso,
 * usado para abrir no compositor uma descrição de tarefa que já existe.
 *
 * Limitação conhecida: não há escape de caracteres. Um "*" digitado
 * literalmente pode virar marcação (ex: "2*3*4" → "3" em itálico).
 */

interface InlineRule {
  marks: RichTextMark[];
  regex: RegExp;
}

// Ordem importa: *** antes de **, e ** antes de *, senão "**x**" casaria
// como itálico duplo
const INLINE_RULES: InlineRule[] = [
  { marks: ['bold', 'italic'], regex: /\*\*\*([^*]+)\*\*\*/ },
  { marks: ['bold'],           regex: /\*\*([^*]+)\*\*/ },
  { marks: ['underline'],      regex: /__([^_]+)__/ },
  { marks: ['strike'],         regex: /~~([^~]+)~~/ },
  { marks: ['code'],           regex: /`([^`]+)`/ },
  { marks: ['italic'],         regex: /\*([^*]+)\*/ },
];

function mergeMarks(inherited: RichTextMark[], added: RichTextMark[]): RichTextMark[] {
  return [...inherited, ...added.filter((m) => !inherited.includes(m))];
}

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
      ...parseInline(inner, mergeMarks(inherited, rule.marks)),
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

    // "•" é o marcador que o compositor do celular mostra; "-" e "*" são
    // aceitos para quem digita a marcação à mão
    const bullet  = /^\s*(?:[-*]\s+|•\s*)(.*)$/.exec(line);
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

/** Envolve o texto de um trecho com a marcação equivalente às suas marcas. */
function textRunToMarkdown(node: RichTextText): string {
  const marks = node.marks ?? [];
  // Quebra de linha dentro do parágrafo vira linha nova (que o parser lê
  // como novo parágrafo — visualmente equivalente)
  return node.text.split('\n').map((piece) => {
    if (piece.length === 0) return piece;
    let s = piece;
    if (marks.includes('code'))      s = `\`${s}\``;
    if (marks.includes('strike'))    s = `~~${s}~~`;
    if (marks.includes('underline')) s = `__${s}__`;

    const bold   = marks.includes('bold');
    const italic = marks.includes('italic');
    if (bold && italic) s = `***${s}***`;
    else if (bold)      s = `**${s}**`;
    else if (italic)    s = `*${s}*`;
    return s;
  }).join('\n');
}

function runsToMarkdown(nodes: RichTextText[] | undefined): string {
  return (nodes ?? []).map(textRunToMarkdown).join('');
}

/**
 * Caminho inverso de `markdownToRichText`: transforma o documento na marcação
 * leve do compositor mobile, para editar um texto que já existe.
 */
export function richTextToMarkdown(doc: RichTextDoc): string {
  const lines: string[] = [];

  for (const block of doc.content) {
    if (block.type === 'paragraph') {
      lines.push(runsToMarkdown(block.content));
      continue;
    }
    block.content.forEach((item, i) => {
      const prefix = block.type === 'bulletList' ? '• ' : `${i + 1}. `;
      const text = item.content.map((p) => runsToMarkdown(p.content)).join(' ').replace(/\n/g, ' ');
      lines.push(`${prefix}${text}`);
    });
  }

  return lines.join('\n');
}
