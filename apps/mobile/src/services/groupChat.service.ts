import type { GroupMessage, RichTextDoc } from '@prodscore/shared';
import { api } from './api';
import type { PickedImage } from '../lib/useImageUpload';

/** Histórico do chat do grupo (mais antigas → mais novas). `before` pagina para trás. */
export async function getGroupMessages(groupId: string, before?: string): Promise<{ messages: GroupMessage[]; hasMore: boolean }> {
  const { data } = await api.get<{ mensagens: GroupMessage[]; temMais: boolean }>(
    `/groups/${groupId}/chat/messages`,
    { params: before ? { before } : {} },
  );
  return { messages: data.mensagens, hasMore: data.temMais };
}

/** Envia mensagem (texto rico e/ou imagem já enviada por uploadGroupChatImage). */
export async function sendGroupMessage(
  groupId: string,
  input: { content?: RichTextDoc | null; imagePath?: string | null },
): Promise<GroupMessage> {
  const { data } = await api.post<{ mensagem: GroupMessage }>(`/groups/${groupId}/chat/messages`, {
    content:   input.content   ?? null,
    imagePath: input.imagePath ?? null,
  });
  return data.mensagem;
}

/** Sobe a imagem da mensagem; devolve o path a enviar junto da mensagem. */
export async function uploadGroupChatImage(groupId: string, image: PickedImage): Promise<{ imagePath: string; imageUrl: string }> {
  const formData = new FormData();
  formData.append('image', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);

  const { data } = await api.post<{ imagePath: string; imageUrl: string }>(
    `/groups/${groupId}/chat/image`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

/** Marca o chat do grupo como lido. */
export async function markGroupChatRead(groupId: string): Promise<void> {
  await api.post(`/groups/${groupId}/chat/read`);
}

/** Quantidade de mensagens não lidas do grupo. */
export async function getGroupUnreadCount(groupId: string): Promise<number> {
  const { data } = await api.get<{ naoLidas: number }>(`/groups/${groupId}/chat/unread-count`);
  return data.naoLidas;
}
