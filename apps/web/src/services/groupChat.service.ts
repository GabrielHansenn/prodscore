import type { GroupMessage, RichTextDoc } from '@prodscore/shared';
import { api, callApi } from './api.js';

/** Histórico do chat do grupo (mais antigas → mais novas). `before` pagina para trás. */
export async function getGroupMessages(groupId: string, before?: string): Promise<{ messages: GroupMessage[]; hasMore: boolean }> {
  return callApi(async () => {
    const { data } = await api.get<{ mensagens: GroupMessage[]; temMais: boolean }>(
      `/groups/${groupId}/chat/messages`,
      { params: before ? { before } : {} },
    );
    return { messages: data.mensagens, hasMore: data.temMais };
  }, 'Erro ao carregar mensagens do grupo.');
}

/** Envia mensagem (texto rico e/ou imagem já enviada por uploadGroupChatImage). */
export async function sendGroupMessage(
  groupId: string,
  input: { content?: RichTextDoc | null; imagePath?: string | null },
): Promise<GroupMessage> {
  return callApi(async () => {
    const { data } = await api.post<{ mensagem: GroupMessage }>(`/groups/${groupId}/chat/messages`, {
      content:   input.content   ?? null,
      imagePath: input.imagePath ?? null,
    });
    return data.mensagem;
  }, 'Erro ao enviar mensagem.');
}

/** Sobe a imagem da mensagem; devolve o path a enviar junto da mensagem. */
export async function uploadGroupChatImage(groupId: string, file: File): Promise<{ imagePath: string; imageUrl: string }> {
  return callApi(async () => {
    const formData = new FormData();
    formData.append('image', file);
    const { data } = await api.post<{ imagePath: string; imageUrl: string }>(
      `/groups/${groupId}/chat/image`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  }, 'Erro ao enviar a imagem.');
}

/** Marca o chat do grupo como lido. */
export async function markGroupChatRead(groupId: string): Promise<void> {
  return callApi(async () => {
    await api.post(`/groups/${groupId}/chat/read`);
  }, 'Erro ao marcar mensagens como lidas.');
}

/** Quantidade de mensagens não lidas do grupo. */
export async function getGroupUnreadCount(groupId: string): Promise<number> {
  return callApi(async () => {
    const { data } = await api.get<{ naoLidas: number }>(`/groups/${groupId}/chat/unread-count`);
    return data.naoLidas;
  }, 'Erro ao contar mensagens.');
}
