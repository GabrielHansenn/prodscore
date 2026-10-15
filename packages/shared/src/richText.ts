/**
 * Documento de texto rico — subconjunto do formato do ProseMirror/Tiptap.
 *
 * Por que JSON estruturado e não HTML:
 *   1. Segurança — `normalizeRichText` RECONSTRÓI o documento a partir de uma
 *      allowlist de tipos e marcas; qualquer coisa fora dela é descartada. Não
 *      existe markup para escapar, então não há superfície de XSS (nem
 *      `dangerouslySetInnerHTML` no web).
 *   2. React Native não renderiza HTML — com JSON, o mobile mapeia cada nó
 *      para <Text> aninhado sem parser nem dependência extra.
 *
 * O web usa o formato nativo do Tiptap (`editor.getJSON()`); o mobile monta o
 * mesmo documento a partir da barra de atalhos do compositor.
 */

/** Marcas de formatação inline suportadas */
export const RICH_TEXT_MARKS = ['bold', 'italic', 'underline', 'strike', 'code'] as const;
export type RichTextMark = typeof RICH_TEXT_MARKS[number];

export interface RichTextText {
  type: 'text';
  text: string;
  marks?: RichTextMark[];
}

export interface RichTextParagraph {
  type: 'paragraph';
  content?: RichTextText[];
}

export interface RichTextListItem {
  type: 'listItem';
  content: RichTextParagraph[];
}

export interface RichTextList {
  type: 'bulletList' | 'orderedList';
  content: RichTextListItem[];
}

export type RichTextBlock = RichTextParagraph | RichTextList;

export interface RichTextDoc {
  type: 'doc';
  content: RichTextBlock[];
}

/** Limite de caracteres de texto puro numa mensagem */
export const MAX_RICH_TEXT_LENGTH = 4000;

/** Documento vazio — usado como valor inicial do editor */
export function emptyRichTextDoc(): RichTextDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

const MARK_SET = new Set<string>(RICH_TEXT_MARKS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Marcas do Tiptap chegam como `[{ type: 'bold' }]`; aceita também `['bold']`. */
function normalizeMarks(input: unknown): RichTextMark[] | undefined {
  if (!Array.isArray(input)) return undefined;

  const marks: RichTextMark[] = [];
  for (const raw of input) {
    const name = typeof raw === 'string' ? raw : isRecord(raw) ? raw['type'] : undefined;
    if (typeof name === 'string' && MARK_SET.has(name) && !marks.includes(name as RichTextMark)) {
      marks.push(name as RichTextMark);
    }
  }
  return marks.length > 0 ? marks : undefined;
}

function normalizeTextNodes(input: unknown): RichTextText[] {
  if (!Array.isArray(input)) return [];

  const nodes: RichTextText[] = [];
  for (const raw of input) {
    if (!isRecord(raw)) continue;
    // Quebra de linha explícita do editor vira espaço — o parágrafo já separa blocos
    if (raw['type'] === 'hardBreak') {
      nodes.push({ type: 'text', text: '\n' });
      continue;
    }
    if (raw['type'] !== 'text' || typeof raw['text'] !== 'string') continue;

    const text = raw['text'];
    if (text.length === 0) continue;

    const marks = normalizeMarks(raw['marks']);
    nodes.push(marks ? { type: 'text', text, marks } : { type: 'text', text });
  }
  return nodes;
}

function normalizeParagraph(input: unknown): RichTextParagraph | null {
  if (!isRecord(input) || input['type'] !== 'paragraph') return null;
  const content = normalizeTextNodes(input['content']);
  return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function normalizeList(input: unknown): RichTextList | null {
  if (!isRecord(input)) return null;
  const type = input['type'];
  if (type !== 'bulletList' && type !== 'orderedList') return null;
  if (!Array.isArray(input['content'])) return null;

  const items: RichTextListItem[] = [];
  for (const rawItem of input['content']) {
    if (!isRecord(rawItem) || rawItem['type'] !== 'listItem' || !Array.isArray(rawItem['content'])) continue;

    const paragraphs = rawItem['content']
      .map(normalizeParagraph)
      .filter((p): p is RichTextParagraph => p !== null);

    if (paragraphs.length > 0) items.push({ type: 'listItem', content: paragraphs });
  }

  return items.length > 0 ? { type, content: items } : null;
}

/**
 * Valida e reconstrói um documento vindo do cliente, mantendo apenas os tipos
 * e marcas conhecidos. É a fronteira de segurança do texto rico: o que sai
 * daqui é sempre um documento seguro para renderizar.
 *
 * @returns o documento normalizado, ou `null` se não sobrou nada de útil
 */
export function normalizeRichText(input: unknown): RichTextDoc | null {
  if (!isRecord(input) || input['type'] !== 'doc' || !Array.isArray(input['content'])) return null;

  const blocks: RichTextBlock[] = [];
  for (const raw of input['content']) {
    const list = normalizeList(raw);
    if (list) { blocks.push(list); continue; }

    const paragraph = normalizeParagraph(raw);
    if (paragraph) blocks.push(paragraph);
  }

  // Remove parágrafos vazios nas pontas (o editor costuma deixar um sobrando)
  while (blocks.length > 0 && isEmptyBlock(blocks[0]!)) blocks.shift();
  while (blocks.length > 0 && isEmptyBlock(blocks[blocks.length - 1]!)) blocks.pop();

  return blocks.length > 0 ? { type: 'doc', content: blocks } : null;
}

function isEmptyBlock(block: RichTextBlock): boolean {
  return block.type === 'paragraph' && (block.content === undefined || block.content.length === 0);
}

/** Texto puro do documento — usado em prévia de notificação, busca e validação de tamanho. */
export function richTextToPlainText(doc: RichTextDoc): string {
  const parts: string[] = [];

  for (const block of doc.content) {
    if (block.type === 'paragraph') {
      parts.push((block.content ?? []).map((t) => t.text).join(''));
      continue;
    }
    for (const item of block.content) {
      const itemText = item.content.map((p) => (p.content ?? []).map((t) => t.text).join('')).join(' ');
      parts.push(block.type === 'bulletList' ? `• ${itemText}` : itemText);
    }
  }

  return parts.join('\n').trim();
}

/** Documento sem nenhum texto (só parágrafos vazios). */
export function isRichTextEmpty(doc: RichTextDoc): boolean {
  return richTextToPlainText(doc).length === 0;
}

// ---------------------------------------------------------------------------
// Descrições (tarefas e grupos)
// ---------------------------------------------------------------------------
//
// Tarefas e grupos guardam a descrição em duas colunas: `description_rich`
// (documento) e `description` (cópia em texto puro). Registros antigos, de
// antes do texto rico, só têm o texto puro.

/** Limite da descrição de tarefa, contado sobre o texto puro */
export const MAX_TASK_DESCRIPTION_LENGTH = 2000;

/** Limite da descrição de grupo (CHECK do banco), contado sobre o texto puro */
export const MAX_GROUP_DESCRIPTION_LENGTH = 500;

/**
 * Converte texto puro (descrições antigas, anteriores ao texto rico) num
 * documento, preservando as quebras de linha: linhas em branco separam
 * parágrafos e quebras simples ficam dentro do parágrafo como "\n".
 * Nenhum caractere é interpretado como marcação — o texto aparece igual.
 *
 * @returns o documento, ou `null` se o texto estiver vazio
 */
export function plainTextToRichText(text: string): RichTextDoc | null {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/^\n+|\n+$/g, ''))
    .filter((p) => p.trim().length > 0);

  if (paragraphs.length === 0) return null;

  return {
    type: 'doc',
    content: paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
  };
}

/**
 * Documento a exibir para a descrição de uma tarefa ou grupo. Registros novos
 * têm `descriptionRich`; os antigos só têm o texto puro em `description`, que
 * é convertido sem alterar a aparência.
 *
 * @returns o documento, ou `null` se não há descrição
 */
export function getDescriptionDoc(item: {
  description: string | null;
  descriptionRich?: RichTextDoc | null | undefined;
}): RichTextDoc | null {
  if (item.descriptionRich) return item.descriptionRich;
  return item.description ? plainTextToRichText(item.description) : null;
}
