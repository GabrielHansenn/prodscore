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

/** Tamanho máximo aceito para o arquivo de comprovação (5 MB) */
export const MAX_PROOF_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Mesmo limite, em MB — conveniência para mensagens de UI */
export const MAX_PROOF_FILE_SIZE_MB = MAX_PROOF_FILE_SIZE_BYTES / (1024 * 1024);
