import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_MB } from '@prodscore/shared';
import { supabase } from './supabase.js';
import { AppError } from './errors.js';
import { detectDisplayImageType, extensionForDisplayImageType } from './imageSniff.js';

/**
 * Valida (tamanho + tipo real via magic bytes) e sobe uma imagem para o
 * bucket público "avatars", devolvendo a URL pública.
 *
 * Compartilhado entre o upload de avatar de perfil (user.service.ts) e o de
 * capa de grupo (group.service.ts) — mesmo bucket, mesma validação, só o
 * caminho dentro do bucket muda entre os dois usos (por isso recebe um
 * `pathBuilder`, chamado só depois que a extensão real é conhecida).
 */
export async function uploadImageToAvatarsBucket(
  buffer: Buffer,
  pathBuilder: (extension: string) => string,
): Promise<string> {
  if (buffer.length === 0) {
    throw new AppError('Arquivo vazio.', 400, 'ARQUIVO_INVALIDO');
  }
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new AppError(`A imagem deve ter no máximo ${MAX_IMAGE_SIZE_MB} MB.`, 400, 'ARQUIVO_MUITO_GRANDE');
  }

  const contentType = detectDisplayImageType(buffer);
  if (!contentType) {
    throw new AppError(
      'Formato de imagem inválido. Envie um arquivo JPEG, PNG, WebP ou GIF.',
      400,
      'FORMATO_INVALIDO',
    );
  }

  const path = pathBuilder(extensionForDisplayImageType(contentType));

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, { contentType, upsert: true });

  if (error) {
    console.error('[avatarsBucket.uploadImageToAvatarsBucket] upload falhou:', error, { path, contentType, size: buffer.length });
    throw new AppError('Erro ao enviar a imagem. Tente novamente.', 500, 'UPLOAD_FALHOU');
  }

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
  return publicUrl;
}
