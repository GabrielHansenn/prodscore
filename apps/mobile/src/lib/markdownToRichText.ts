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
