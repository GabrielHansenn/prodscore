/**
 * Critério de validação para imagens de exibição (avatar de perfil, capa de
 * grupo) — diferente do critério de comprovação de tarefa (proof.ts), que é
 * mais permissivo em tamanho mas mais restrito em formato.
 */
export type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export const ACCEPTED_IMAGE_MIME_TYPES: ReadonlyArray<ImageMimeType> = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/** Tamanho máximo aceito (2 MB) */
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

/** Mesmo limite, em MB — conveniência para mensagens de UI */
export const MAX_IMAGE_SIZE_MB = MAX_IMAGE_SIZE_BYTES / (1024 * 1024);
