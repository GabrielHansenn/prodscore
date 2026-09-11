import type { Message } from '@prodscore/shared';
import { api, callApi } from './api.js';

/** Histórico com um amigo (mais antigas → mais novas). `before` pagina para trás. */
export async function getMessages(friendId: string, before?: string): Promise<{ messages: Message[]; hasMore: boolean }> {
  return callApi(async () => {
    const { data } = await api.get<{ mensagens: Message[]; temMais: boolean }>(
      `/friends/${friendId}/messages`,
      { params: before ? { before } : {} },
    );
    return { messages: data.mensagens, hasMore: data.temMais };
  }, 'Erro ao carregar mensagens.');
}

/** Envia uma mensagem para um amigo. */
export async function sendMessage(friendId: string, content: string): Promise<Message> {
  return callApi(async () => {
    const { data } = await api.post<{ mensagem: Message }>(`/friends/${friendId}/messages`, { content });
    return data.mensagem;
  }, 'Erro ao enviar mensagem.');
}

/** Marca como lidas todas as mensagens recebidas desse amigo. */
export async function markConversationRead(friendId: string): Promise<void> {
  return callApi(async () => {
    await api.post(`/friends/${friendId}/messages/read`);
  }, 'Erro ao marcar mensagens como lidas.');
}

/** Não lidas por remetente: { [senderId]: quantidade }. */
export async function getUnreadCounts(): Promise<Record<string, number>> {
  return callApi(async () => {
    const { data } = await api.get<{ naoLidas: Record<string, number> }>('/friends/unread');
    return data.naoLidas;
  }, 'Erro ao buscar mensagens não lidas.');
}
