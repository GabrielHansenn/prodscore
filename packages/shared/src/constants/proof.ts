import type { ProofMimeType } from '../types/index.js';

/**
 * Formatos de imagem aceitos para comprovação fotográfica de tarefa.
 * Usado tanto para validar no client (feedback rápido) quanto no servidor
 * (validação real, via magic bytes — ver packages/api/src/lib/imageSniff.ts).
 */
export const ACCEPTED_PROOF_MIME_TYPES: ReadonlyArray<ProofMimeType> = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

/**
 * Tamanho máximo aceito para o arquivo de comprovação (4 MB).
 * Era 5 MB, mas a Vercel recusa requisições acima de 4,5 MB: uma foto entre
 * 4,5 e 5 MB passaria na validação e falharia no envio.
 */
export const MAX_PROOF_FILE_SIZE_BYTES = 4 * 1024 * 1024;

/** Mesmo limite, em MB — conveniência para mensagens de UI */
export const MAX_PROOF_FILE_SIZE_MB = MAX_PROOF_FILE_SIZE_BYTES / (1024 * 1024);
