/**
 * Utilitários do compositor de texto rico do mobile.
 *
 * A conversão marcação ↔ documento mora em @prodscore/shared
 * (richTextMarkdown.ts) para ser testada e reaproveitada; aqui ficam só as
 * operações de edição usadas pela barra de atalhos.
 */

export { markdownToRichText, richTextToMarkdown } from '@prodscore/shared';

/** Botões de formatação inline da barra de atalhos (chat e descrição de tarefa) */
export const FORMAT_BUTTONS: { label: string; wrapper: string; icon: string }[] = [
  { label: 'Negrito',    wrapper: '**', icon: 'B' },
  { label: 'Itálico',    wrapper: '*',  icon: 'I' },
  { label: 'Sublinhado', wrapper: '__', icon: 'U' },
  { label: 'Tachado',    wrapper: '~~', icon: 'S' },
  { label: 'Código',     wrapper: '`',  icon: '</>' },
];

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

/** Marcador da lista com marcadores no compositor (o conversor também aceita "- " e "* ") */
export const BULLET_PREFIX = '• ';

/** Prefixo de lista no começo de uma linha: "• ", "- ", "* " ou "1. " */
const LIST_PREFIX = /^(?:[•*-] |\d+\. )/;
const BULLET_LINE = /^[•*-] (.*)$/;
const ORDERED_LINE = /^(\d+)\. (.*)$/;

type Edit = { text: string; selection: { start: number; end: number } };

/**
 * Prefixa as linhas da seleção com "• " ou "1. " (remove se já forem desse
 * tipo; troca se forem do outro tipo de lista).
 *
 * O cursor anda junto com o prefixo da primeira linha: antes ele ficava
 * ANTES do "- " recém-inserido e o que se digitava entrava na frente do
 * marcador ("abc- "), quebrando a lista.
 */
export function toggleListPrefix(
  text: string,
  selection: { start: number; end: number },
  kind: 'bullet' | 'ordered',
): Edit {
  const lineStart = text.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
  const lineEndRaw = text.indexOf('\n', selection.end);
  const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;

  const block = text.slice(lineStart, lineEnd);
  const lines = block.split('\n');

  const prefixOf = (i: number) => (kind === 'bullet' ? BULLET_PREFIX : `${i + 1}. `);
  const isKind = (l: string) => (kind === 'bullet' ? BULLET_LINE : ORDERED_LINE).test(l);
  const alreadyPrefixed = lines.every(isKind);

  const nextLines = lines.map((l, i) => {
    const bare = l.replace(LIST_PREFIX, '');
    return alreadyPrefixed ? bare : `${prefixOf(i)}${bare}`;
  });

  const nextBlock = nextLines.join('\n');
  const next = text.slice(0, lineStart) + nextBlock + text.slice(lineEnd);
  const firstDelta = nextLines[0]!.length - lines[0]!.length;
  const delta = nextBlock.length - block.length;

  return {
    text: next,
    selection: {
      // Seleção que começa no início da linha continua pegando a linha toda
      start: selection.start !== selection.end && selection.start === lineStart
        ? lineStart
        : Math.max(lineStart, selection.start + firstDelta),
      end: Math.max(lineStart, selection.end + delta),
    },
  };
}

/**
 * Enter dentro de uma lista: continua a lista na linha nova ("• " ou o
 * próximo número). Enter num item vazio sai da lista (remove o marcador),
 * como nos editores de texto comuns.
 *
 * Recebe o texto antes e depois da digitação e a posição do cursor antes
 * dela; devolve a edição a aplicar, ou null se a mudança não foi um Enter no
 * fim de um item de lista.
 */
export function continueList(prev: string, next: string, cursor?: number): Edit | null {
  if (next.length !== prev.length + 1) return null;
  // Onde o "\n" entrou. Pelo cursor, quando dá: comparar os textos é ambíguo
  // se já havia uma quebra de linha logo depois ("a\nb" → "a\n\nb")
  const insertedAt = (at: number) =>
    next[at] === '\n' && next.slice(0, at) === prev.slice(0, at) && next.slice(at + 1) === prev.slice(at);
  let i: number;
  if (cursor !== undefined && insertedAt(cursor)) {
    i = cursor;
  } else {
    i = 0;
    while (i < prev.length && prev[i] === next[i]) i++;
    if (!insertedAt(i)) return null;
  }

  const lineStart = next.lastIndexOf('\n', i - 1) + 1;
  const line = next.slice(lineStart, i);
  const bullet = BULLET_LINE.exec(line);
  const ordered = ORDERED_LINE.exec(line);
  if (!bullet && !ordered) return null;

  const content = (bullet ? bullet[1] : ordered![2]) ?? '';
  if (content.trim() === '') {
    // Item vazio: sai da lista — apaga o marcador e não cria linha nova
    const text = prev.slice(0, lineStart) + prev.slice(i);
    return { text, selection: { start: lineStart, end: lineStart } };
  }

  const prefix = bullet ? BULLET_PREFIX : `${Number(ordered![1]) + 1}. `;
  const text = next.slice(0, i + 1) + prefix + next.slice(i + 1);
  const caret = i + 1 + prefix.length;
  return { text, selection: { start: caret, end: caret } };
}
