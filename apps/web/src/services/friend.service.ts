import type { Friend, FriendRequest, FriendUser, UserSearchResult } from '@prodscore/shared';
import { api, callApi } from './api.js';
import type { StatisticsData } from '../components/StatisticsContent.js';

export interface FriendStats {
  usuario:      FriendUser;
  estatisticas: StatisticsData & { rankPosition: number };
}

/** Estatísticas completas de um amigo (403 se não forem amigos). */
export async function getFriendStats(userId: string): Promise<FriendStats> {
  return callApi(async () => {
    const { data } = await api.get<FriendStats>(`/users/${userId}/stats`);
    return data;
  }, 'Erro ao carregar o perfil do amigo.');
}

/** Busca usuários por prefixo de username (mín. 2 caracteres). */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  return callApi(async () => {
    const { data } = await api.get<{ usuarios: UserSearchResult[] }>('/users/search', { params: { q: query } });
    return data.usuarios;
  }, 'Erro ao buscar usuários.');
}

/** Lista de amigos (amizades aceitas). */
export async function getFriends(): Promise<Friend[]> {
  return callApi(async () => {
    const { data } = await api.get<{ amigos: Friend[] }>('/friends');
    return data.amigos;
  }, 'Erro ao carregar amigos.');
}

/** Pedidos pendentes recebidos ou enviados. */
export async function getFriendRequests(direction: 'received' | 'sent'): Promise<FriendRequest[]> {
  return callApi(async () => {
    const { data } = await api.get<{ pedidos: FriendRequest[] }>('/friends/requests', { params: { direction } });
    return data.pedidos;
  }, 'Erro ao carregar pedidos.');
}

/** Envia um pedido de amizade para o usuário informado. */
export async function sendFriendRequest(addresseeId: string): Promise<FriendRequest> {
  return callApi(async () => {
    const { data } = await api.post<{ pedido: FriendRequest }>('/friends/requests', { addresseeId });
    return data.pedido;
  }, 'Erro ao enviar pedido de amizade.');
}

/** Aceita um pedido recebido. */
export async function acceptFriendRequest(requestId: string): Promise<FriendRequest> {
  return callApi(async () => {
    const { data } = await api.post<{ pedido: FriendRequest }>(`/friends/requests/${requestId}/accept`);
    return data.pedido;
  }, 'Erro ao aceitar pedido.');
}

/** Recusa um pedido recebido. */
export async function declineFriendRequest(requestId: string): Promise<FriendRequest> {
  return callApi(async () => {
    const { data } = await api.post<{ pedido: FriendRequest }>(`/friends/requests/${requestId}/decline`);
    return data.pedido;
  }, 'Erro ao recusar pedido.');
}

/** Remove uma amizade ou cancela um pedido enviado. */
export async function removeFriend(otherUserId: string): Promise<void> {
  return callApi(async () => {
    await api.delete(`/friends/${otherUserId}`);
  }, 'Erro ao remover amizade.');
}
