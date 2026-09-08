import { type Group, MemberRole } from '@prodscore/shared';
import { api, callApi } from './api.js';
import type { MissionWithParticipation } from './mission.service.js';

// ---------------------------------------------------------------------------
// Tipos de resposta da API de grupos
// ---------------------------------------------------------------------------

export interface GroupWithMeta extends Group {
  role:        MemberRole;
  memberCount: number;
}

export interface GroupDetails extends Group {
  role:               MemberRole;
  memberCount:        number;
  activeMissionCount: number;
}

export interface GroupMember {
  userId:        string;
  username:      string;
  avatarUrl:     string | null;
  role:          MemberRole;
  level:         number;
  totalPoints:   number;
  currentStreak: number;
  longestStreak: number;
  joinedAt:      string;
}

export interface GroupRankingRow {
  position:        number;
  userId:          string;
  username:        string;
  avatarUrl:       string | null;
  level:           number;
  score:           number;
  currentStreak:   number;
  consistencyRate: number;
}

// ---------------------------------------------------------------------------
// Funções de serviço
// ---------------------------------------------------------------------------

/**
 * Retorna todos os grupos dos quais o usuário autenticado é membro.
 */
export async function getGroups(): Promise<GroupWithMeta[]> {
  return callApi(async () => {
    const { data } = await api.get<{ grupos: GroupWithMeta[] }>('/groups');
    return data.grupos;
  }, 'Erro ao carregar seus grupos.');
}

/**
 * Cria um novo grupo e define o criador como owner.
 */
export async function createGroup(input: {
  name:         string;
  description?: string;
  imageUrl?:    string;
}): Promise<Group> {
  return callApi(async () => {
    const { data } = await api.post<{ grupo: Group }>('/groups', input);
    return data.grupo;
  }, 'Erro ao criar grupo.');
}

/**
 * Entra em um grupo usando o código de convite.
 */
export async function joinGroup(inviteCode: string): Promise<Group> {
  return callApi(async () => {
    const { data } = await api.post<{ grupo: Group }>('/groups/join', {
      invite_code: inviteCode.trim().toUpperCase(),
    });
    return data.grupo;
  }, 'Código de convite inválido ou expirado.');
}

/**
 * Retorna os detalhes completos de um grupo (apenas para membros).
 */
export async function getGroupDetail(id: string): Promise<GroupDetails> {
  return callApi(async () => {
    const { data } = await api.get<{ grupo: GroupDetails }>(`/groups/${id}`);
    return data.grupo;
  }, 'Erro ao carregar o grupo.');
}

/**
 * Lista os membros de um grupo com suas estatísticas de gamificação.
 */
export async function getGroupMembers(id: string): Promise<GroupMember[]> {
  return callApi(async () => {
    const { data } = await api.get<{ membros: GroupMember[] }>(`/groups/${id}/members`);
    return data.membros;
  }, 'Erro ao carregar os membros do grupo.');
}

/**
 * Retorna as missões ativas do grupo com o progresso do usuário.
 */
export async function getGroupMissions(id: string): Promise<MissionWithParticipation[]> {
  return callApi(async () => {
    const { data } = await api.get<{ missoes: MissionWithParticipation[] }>(`/groups/${id}/missions`);
    return data.missoes;
  }, 'Erro ao carregar as missões do grupo.');
}

/**
 * Atualiza nome, descrição, URL da imagem ou configuração de missões do grupo.
 */
export async function updateGroupInfo(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    imageUrl?: string | null;
    countExternalTasksInMissions?: boolean;
  },
): Promise<Group> {
  return callApi(async () => {
    const { data } = await api.patch<{ grupo: Group }>(`/groups/${id}`, input);
    return data.grupo;
  }, 'Erro ao salvar as informações do grupo.');
}

/**
 * Gera um novo código de convite para o grupo.
 */
export async function regenerateInviteCode(id: string): Promise<string> {
  return callApi(async () => {
    const { data } = await api.post<{ inviteCode: string }>(`/groups/${id}/regenerate-invite`, {});
    return data.inviteCode;
  }, 'Erro ao gerar novo código de convite.');
}

/**
 * Altera o papel de um membro do grupo (admin ou member).
 */
export async function updateMemberRole(
  groupId: string,
  targetUserId: string,
  role: 'admin' | 'member',
): Promise<void> {
  await callApi(
    () => api.patch(`/groups/${groupId}/members/${targetUserId}`, { role }),
    'Erro ao alterar o papel do membro.',
  );
}

/**
 * Remove um membro do grupo (kick).
 */
export async function kickMember(groupId: string, targetUserId: string): Promise<void> {
  await callApi(
    () => api.delete(`/groups/${groupId}/members/${targetUserId}`),
    'Erro ao remover o membro.',
  );
}

/**
 * Sai do grupo (para membros e admins — não o owner).
 */
export async function leaveGroup(groupId: string): Promise<void> {
  await callApi(
    () => api.post(`/groups/${groupId}/leave`, {}),
    'Erro ao sair do grupo.',
  );
}

/**
 * Exclui permanentemente o grupo (apenas o owner).
 */
export async function deleteGroup(groupId: string): Promise<void> {
  await callApi(
    () => api.delete(`/groups/${groupId}`),
    'Erro ao excluir o grupo.',
  );
}

/**
 * Retorna o ranking interno do grupo com pontuação multi-fator.
 */
export async function getGroupRanking(id: string): Promise<GroupRankingRow[]> {
  return callApi(async () => {
    const { data } = await api.get<{ ranking: Array<{
      position: number;
      user: { id: string; username: string; avatarUrl: string | null; level: number };
      score: number;
      currentStreak: number;
      consistencyRate: number;
    }> }>(`/groups/${id}/ranking`);

    return data.ranking.map((row) => ({
      position:        row.position,
      userId:          row.user.id,
      username:        row.user.username,
      avatarUrl:       row.user.avatarUrl,
      level:           row.user.level,
      score:           row.score,
      currentStreak:   row.currentStreak,
      consistencyRate: row.consistencyRate,
    }));
  }, 'Erro ao carregar o ranking do grupo.');
}
