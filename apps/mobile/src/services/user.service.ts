import { api } from './api';
import type { PickedImage } from '../lib/useImageUpload';

/**
 * Sobe a foto de perfil e devolve a URL pública — o mobile não fala com o
 * Supabase Storage direto (diferente do web), então o upload passa pela API.
 * Espelha uploadGroupImage em group.service.ts.
 */
export async function uploadAvatar(image: PickedImage): Promise<string> {
  const formData = new FormData();
  formData.append('avatar', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);

  const { data } = await api.post<{ avatarUrl: string }>('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.avatarUrl;
}
