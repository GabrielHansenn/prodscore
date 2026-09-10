import { uploadImageToAvatarsBucket } from '../lib/avatarsBucket.js';

/**
 * Sobe a foto de perfil do usuário pro bucket "avatars" e devolve a URL
 * pública. Caminho estável (`{userId}/avatar.{ext}`, upsert) — igual ao que o
 * web já faz fazendo upload direto do navegador; aqui passa pela API porque
 * o mobile não fala com o Supabase Storage diretamente.
 */
export async function uploadUserAvatar(userId: string, buffer: Buffer): Promise<string> {
  return uploadImageToAvatarsBucket(buffer, (ext) => `${userId}/avatar.${ext}`);
}
