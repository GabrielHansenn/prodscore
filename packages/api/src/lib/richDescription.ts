import { normalizeRichText, richTextToPlainText, type RichTextDoc } from '@prodscore/shared';
import { AppError } from './errors.js';

/** Valor das duas colunas de descrição a gravar (campos ausentes = não alterar) */
export interface ResolvedDescription {
  description?:     string | null;
  descriptionRich?: RichTextDoc | null;
}

/**
 * Decide o que gravar nas colunas `description` (texto puro) e
 * `description_rich` (documento) a partir do corpo da requisição — usado por
 * tarefas e grupos:
 *
 * - `descriptionRich` informado (clientes atuais): o documento passa por
 *   `normalizeRichText` (allowlist — descarta qualquer nó/marca desconhecido)
 *   e `description` vira a versão em texto puro dele. `null` limpa a descrição.
 * - só `description` (clientes antigos): grava o texto puro e limpa o
 *   documento, para não sobrar uma versão formatada desatualizada.
 * - nenhum dos dois: não mexe na descrição.
 *
 * @param maxLength - limite de caracteres do texto puro
 * @throws AppError 400 se o texto passar do limite
 */
export function resolveRichDescription(
  body: { description?: string | null | undefined; descriptionRich?: unknown },
  maxLength: number,
): ResolvedDescription {
  if (body.descriptionRich !== undefined) {
    const doc   = normalizeRichText(body.descriptionRich);
    const plain = doc ? richTextToPlainText(doc) : '';

    if (plain.length > maxLength) {
      throw new AppError(`A descrição deve ter no máximo ${maxLength} caracteres.`, 400, 'VALIDACAO_INVALIDA');
    }
    return { description: plain || null, descriptionRich: doc };
  }

  if (body.description !== undefined) {
    return { description: body.description, descriptionRich: null };
  }

  return {};
}
