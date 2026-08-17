import type { ProofMimeType } from '@prodscore/shared';

/**
 * Detecta o tipo real de uma imagem a partir dos primeiros bytes do arquivo
 * (magic bytes), em vez de confiar no Content-Type informado pelo cliente
 * (facilmente falsificável). Suporta apenas os formatos aceitos para
 * comprovação de tarefa — qualquer outra assinatura retorna null.
 *
 * Assinaturas:
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - WebP: "RIFF" (bytes 0-3) + "WEBP" (bytes 8-11)
 *
 * @param buffer - Bytes do arquivo enviado
 * @returns O MIME type real detectado, ou null se não corresponder a nenhum formato aceito
 */
export function detectImageType(buffer: Buffer): ProofMimeType | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (pngSignature.every((byte, i) => buffer[i] === byte)) {
    return 'image/png';
  }

  const isRiff = buffer.subarray(0, 4).toString('ascii') === 'RIFF';
  const isWebp = buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (isRiff && isWebp) {
    return 'image/webp';
  }

  return null;
}

/** Extensão de arquivo convencional para cada tipo de imagem aceito */
export function extensionForImageType(type: ProofMimeType): string {
  switch (type) {
    case 'image/jpeg': return 'jpg';
    case 'image/png':  return 'png';
    case 'image/webp': return 'webp';
  }
}
