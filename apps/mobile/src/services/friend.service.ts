import type { Friend, FriendRequest, FriendUser, UserSearchResult } from '@prodscore/shared';
import { api } from './api';
import type { StatisticsData } from '../components/StatisticsContent';

export interface FriendStats {
  usuario:      FriendUser;
  estatisticas: StatisticsData & { rankPosition: number };
}

/** Estatísticas completas de um amigo (403 se não forem amigos). */
export async function getFriendStats(userId: string): Promise<FriendStats> {
  const { data } = await api.get<FriendStats>(`/users/${userId}/stats`);
  return data;
}

/** Busca usuários por prefixo de username (mín. 2 caracteres). */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const { data } = await api.get<{ usuarios: UserSearchResult[] }>('/users/search', { params: { q: query } });
  return data.usuarios;
}

/** Lista de amigos (amizades aceitas). */
export async function getFriends(): Promise<Friend[]> {
  const { data } = await api.get<{ amigos: Friend[] }>('/friends');
  return data.amigos;
}

/** Pedidos pendentes recebidos ou enviados. */
export async function getFriendRequests(direction: 'received' | 'sent'): Promise<FriendRequest[]> {
  const { data } = await api.get<{ pedidos: FriendRequest[] }>('/friends/requests', { params: { direction } });
  return data.pedidos;
}

/** Envia um pedido de amizade para o usuário informado. */
export async function sendFriendRequest(addresseeId: string): Promise<FriendRequest> {
  const { data } = await api.post<{ pedido: FriendRequest }>('/friends/requests', { addresseeId });
  return data.pedido;
}

/** Aceita um pedido recebido. */
export async function acceptFriendRequest(requestId: string): Promise<FriendRequest> {
  const { data } = await api.post<{ pedido: FriendRequest }>(`/friends/requests/${requestId}/accept`);
  return data.pedido;
}

/** Recusa um pedido recebido. */
export async function declineFriendRequest(requestId: string): Promise<FriendRequest> {
  const { data } = await api.post<{ pedido: FriendRequest }>(`/friends/requests/${requestId}/decline`);
  return data.pedido;
}

/** Remove uma amizade ou cancela um pedido enviado. */
export async function removeFriend(otherUserId: string): Promise<void> {
  await api.delete(`/friends/${otherUserId}`);
}
