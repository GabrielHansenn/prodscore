/**
 * Comprime e redimensiona uma imagem no navegador antes do upload, usando
 * Canvas — reduz custo/tempo de envio sem depender de bibliotecas externas.
 *
 * @param file        - Arquivo de imagem original (File ou Blob de captura de câmera)
 * @param maxDimension - Maior dimensão (largura ou altura) permitida, em pixels
 * @param quality      - Qualidade da compressão JPEG (0 a 1)
 * @returns Blob da imagem comprimida em JPEG
 */
export async function compressImage(
  file: Blob,
  maxDimension = 1600,
  quality = 0.8,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width  = Math.round(width  * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Ambiente sem suporte a Canvas 2D — envia o arquivo original sem comprimir
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Falha ao comprimir a imagem.'));
      },
      'image/jpeg',
      quality,
    );
  });
}
