/**
 * Testes do texto rico da descrição de tarefas:
 * - compatibilidade com descrições antigas em texto puro;
 * - normalização (barreira de segurança contra conteúdo desconhecido);
 * - conversão marcação ↔ documento usada pelo compositor mobile.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeRichText,
  plainTextToRichText,
  getDescriptionDoc,
  richTextToPlainText,
  type RichTextDoc,
} from '../richText';
import { markdownToRichText, richTextToMarkdown } from '../richTextMarkdown';

// ---------------------------------------------------------------------------
// Descrições antigas (texto puro)
// ---------------------------------------------------------------------------

describe('plainTextToRichText', () => {
  it('texto vazio ou só espaços não gera documento', () => {
    expect(plainTextToRichText('')).toBeNull();
    expect(plainTextToRichText('  \n\n  ')).toBeNull();
  });

  it('linha em branco separa parágrafos', () => {
    const doc = plainTextToRichText('Primeiro parágrafo\n\nSegundo parágrafo');
    expect(doc?.content).toHaveLength(2);
    expect(richTextToPlainText(doc!)).toBe('Primeiro parágrafo\nSegundo parágrafo');
  });

  it('quebra de linha simples é mantida dentro do parágrafo', () => {
    const doc = plainTextToRichText('linha 1\nlinha 2');
    expect(doc).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'linha 1\nlinha 2' }] }],
    });
  });

  it('NÃO interpreta asteriscos ou hífens como formatação (aparência antiga preservada)', () => {
    const doc = plainTextToRichText('Calcular 2*3*4\n- não é lista');
    const text = doc!.content[0];
    expect(text).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Calcular 2*3*4\n- não é lista' }],
    });
  });

  it('aceita quebras de linha do Windows (\\r\\n)', () => {
    const doc = plainTextToRichText('a\r\n\r\nb');
    expect(doc?.content).toHaveLength(2);
  });
});

describe('getDescriptionDoc', () => {
  const rich: RichTextDoc = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'formatado', marks: ['bold'] }] }],
  };

  it('tarefa nova: usa o documento formatado', () => {
    expect(getDescriptionDoc({ description: 'formatado', descriptionRich: rich })).toBe(rich);
  });

  it('tarefa antiga: converte o texto puro', () => {
    const doc = getDescriptionDoc({ description: 'texto antigo', descriptionRich: null });
    expect(richTextToPlainText(doc!)).toBe('texto antigo');
  });

  it('tarefa sem descrição: null', () => {
    expect(getDescriptionDoc({ description: null, descriptionRich: null })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Normalização (segurança)
// ---------------------------------------------------------------------------

describe('normalizeRichText', () => {
  it('descarta nós e marcas fora da allowlist', () => {
    const doc = normalizeRichText({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'ok', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
        { type: 'image', attrs: { src: 'https://evil.example/x.png' } },
        { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] },
      ],
    });

    expect(doc).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'ok', marks: ['bold'] }] },
        // HTML vira texto literal — nunca é interpretado
        { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] },
      ],
    });
  });

  it('entrada que não é documento retorna null', () => {
    expect(normalizeRichText('texto solto')).toBeNull();
    expect(normalizeRichText(null)).toBeNull();
    expect(normalizeRichText({ type: 'doc', content: 'x' })).toBeNull();
  });

  it('converte hardBreak (Shift+Enter) em quebra de linha', () => {
    const doc = normalizeRichText({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }] }],
    });
    expect(richTextToPlainText(doc!)).toBe('a\nb');
  });
});

// ---------------------------------------------------------------------------
// Marcação leve ↔ documento (compositor mobile)
// ---------------------------------------------------------------------------

describe('markdownToRichText', () => {
  it('interpreta negrito, itálico e os dois juntos', () => {
    const doc = markdownToRichText('**forte** *leve* ***ambos***');
    expect(doc!.content[0]).toEqual({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'forte', marks: ['bold'] },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'leve', marks: ['italic'] },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'ambos', marks: ['bold', 'italic'] },
      ],
    });
  });

  it('linhas com "- " e "1. " viram listas', () => {
    const doc = markdownToRichText('Passos:\n- abrir\n- fechar\n1. um\n2. dois');
    expect(doc!.content.map((b) => b.type)).toEqual(['paragraph', 'bulletList', 'orderedList']);
  });
});

describe('richTextToMarkdown (ida e volta)', () => {
  const casos: Array<[string, string]> = [
    ['texto simples',      'Estudar para a prova'],
    ['negrito e itálico',  '**Importante:** revisar *capítulo 3*'],
    ['negrito + itálico',  '***urgente***'],
    ['sublinhado/tachado', '__sublinhado__ e ~~riscado~~'],
    ['código',             'rodar `npm test`'],
    ['listas',             'Passos:\n- abrir o projeto\n- rodar os testes\n1. primeiro\n2. segundo'],
  ];

  it.each(casos)('%s: documento → marcação → documento não muda', (_nome, markdown) => {
    const doc = markdownToRichText(markdown)!;
    expect(markdownToRichText(richTextToMarkdown(doc))).toEqual(doc);
  });

  it('descrição antiga com quebras de linha abre no compositor com as mesmas linhas', () => {
    const legacy = plainTextToRichText('linha 1\nlinha 2\n\nparágrafo 2')!;
    expect(richTextToMarkdown(legacy)).toBe('linha 1\nlinha 2\nparágrafo 2');
  });
});
