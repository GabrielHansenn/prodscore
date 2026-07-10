import {
  MemberRole,
  type Group,
  type GroupMember,
  type RankingEntry,
} from '@prodscore/shared';
import { supabase } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Tipos internos (linhas do banco em snake_case)
// ---------------------------------------------------------------------------

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  owner_id: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

interface GroupMemberRow {
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

interface ProfileRow {
  id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  total_points: number;
  current_streak: number;
  longest_streak: number;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Converte a linha do banco para a interface Group */
function mapGroupRow(row: GroupRow): Group {
  return {
    id:          row.id,
    name:        row.name,
    description: row.description,
    imageUrl:    row.image_url,
    ownerId:     row.owner_id,
    inviteCode:  row.invite_code,
    createdAt:   row.created_at,
  };
}

/**
 * Gera um código de convite alfanumérico aleatório.
 * @param length - Comprimento do código (padrão 6)
 */
function generateInviteCode(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]!,
  ).join('');
}

/**
 * Calcula o score de ranking multi-fator de um membro.
 *
 * Fórmula: total_points × 0.5 + (streak × 10) × 0.3 + consistency_rate × 0.2
 * @param totalPoints     - Pontos totais acumulados
 * @param currentStreak   - Streak atual em dias
 * @param consistencyRate - Percentual de tarefas concluídas (0–100)
 */
export function computeGroupScore(
  totalPoints: number,
  currentStreak: number,
  consistencyRate: number,
): number {
  return (
    totalPoints * 0.5 +
    currentStreak * 10 * 0.3 +
    consistencyRate * 0.2
  );
}

/**
 * Verifica se um usuário é membro de um grupo e retorna seu papel.
 * Lança AppError 403 se não for membro.
 */
async function requireMembership(
  groupId: string,
  userId: string,
): Promise<{ role: MemberRole }> {
  const { data } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    throw new AppError(
      'Você não é membro deste grupo.',
      403,
      'NAO_MEMBRO_DO_GRUPO',
    );
  }

  return { role: (data as { role: string }).role as MemberRole };
}

// ---------------------------------------------------------------------------
// Criação de grupo
// ---------------------------------------------------------------------------

export interface CreateGroupInput {
  name: string;
  description?: string;
  imageUrl?: string;
  ownerId: string;
}

/**
 * Cria um novo grupo e registra o criador como owner.
 *
 * Gera um invite_code de 6 caracteres único, com até 5 tentativas em caso
 * de colisão (probabilidade ~1 em 2 bilhões por tentativa).
 *
 * @param input - Dados do grupo a criar
 */
export async function createGroup(input: CreateGroupInput): Promise<Group> {
  let groupRow: GroupRow | null = null;
  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const inviteCode = generateInviteCode(6);

    const { data, error } = await supabase
      .from('groups')
      .insert({
        name:        input.name,
        description: input.description  ?? null,
        image_url:   input.imageUrl     ?? null,
        owner_id:    input.ownerId,
        invite_code: inviteCode,
      })
      .select('*')
      .single();

    if (!error && data) {
      groupRow = data as GroupRow;
      break;
    }

    // Código 23505 = unique_violation no PostgreSQL
    const isUnique = error?.code === '23505';
    if (!isUnique) {
      throw new AppError('Erro ao criar grupo.', 500, 'CRIACAO_FALHOU');
    }
    // Colisão de invite_code: tenta novamente com código diferente
  }

  if (!groupRow) {
    throw new AppError(
      'Não foi possível gerar um código de convite único. Tente novamente.',
      500,
      'INVITE_CODE_COLISAO',
    );
  }

  // Registra o criador como owner no grupo
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: groupRow.id,
      user_id:  input.ownerId,
      role:     'owner',
    });

  if (memberError) {
    // O grupo foi criado mas a membership falhou — remove o grupo para consistência
    await supabase.from('groups').delete().eq('id', groupRow.id);
    throw new AppError(
      'Erro ao registrar o criador como membro.',
      500,
      'MEMBERSHIP_FALHOU',
    );
  }

  return mapGroupRow(groupRow);
}

// ---------------------------------------------------------------------------
// Entrar no grupo via código de convite
// ---------------------------------------------------------------------------

/**
 * Adiciona um usuário a um grupo usando o código de convite.
 * Rejeita se o usuário já for membro ou o código for inválido.
 *
 * @param userId     - UUID do usuário que quer entrar
 * @param inviteCode - Código de convite (6 chars, case-insensitive)
 */
export async function joinGroup(
  userId: string,
  inviteCode: string,
): Promise<{ group: Group; membership: GroupMember }> {
  // Busca o grupo pelo código (normalizado para maiúsculas)
  const { data: groupData, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .maybeSingle();

  if (groupError) {
    throw new AppError('Erro ao buscar grupo.', 500);
  }

  if (!groupData) {
    throw new AppError(
      'Código de convite inválido ou expirado.',
      404,
      'INVITE_CODE_INVALIDO',
    );
  }

  const group = mapGroupRow(groupData as GroupRow);

  // Verifica se o usuário já é membro
  const { data: existing } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', group.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    throw new AppError(
      'Você já é membro deste grupo.',
      409,
      'JA_E_MEMBRO',
    );
  }

  // Adiciona como membro com papel padrão
  const { data: memberData, error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id:  userId,
      role:     'member',
    })
    .select('*')
    .single();

  if (memberError || !memberData) {
    throw new AppError('Erro ao entrar no grupo.', 500, 'JOIN_FALHOU');
  }

  const row = memberData as GroupMemberRow;
  const membership: GroupMember = {
    groupId:  row.group_id,
    userId:   row.user_id,
    role:     row.role as MemberRole,
    joinedAt: row.joined_at,
  };

  return { group, membership };
}

// ---------------------------------------------------------------------------
// Listagem dos grupos do usuário
// ---------------------------------------------------------------------------

/**
 * Retorna todos os grupos dos quais o usuário é membro.
 * Inclui o papel do usuário em cada grupo.
 *
 * @param userId - UUID do usuário
 */
export async function getUserGroups(userId: string): Promise<Array<Group & { role: MemberRole; memberCount: number }>> {
  // Busca as memberships do usuário com os dados do grupo
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      role,
      groups (
        id, name, description, image_url, owner_id, invite_code, created_at, updated_at
      )
    `)
    .eq('user_id', userId);

  if (error) {
    throw new AppError('Erro ao buscar grupos.', 500, 'BUSCA_FALHOU');
  }

  const rows = (data ?? []) as Array<{
    role: string;
    groups: GroupRow;
  }>;

  // Para cada grupo, busca a contagem de membros
  const groupIds = rows.map((r) => r.groups.id);
  if (groupIds.length === 0) return [];

  const { data: memberCounts } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);

  const countMap = new Map<string, number>();
  (memberCounts ?? []).forEach((m) => {
    const gid = (m as { group_id: string }).group_id;
    countMap.set(gid, (countMap.get(gid) ?? 0) + 1);
  });

  return rows.map((r) => ({
    ...mapGroupRow(r.groups),
    role:        r.role as MemberRole,
    memberCount: countMap.get(r.groups.id) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Detalhes do grupo
// ---------------------------------------------------------------------------

/**
 * Retorna detalhes completos de um grupo (apenas para membros).
 * Inclui contagem de membros e missões ativas.
 *
 * @param groupId - UUID do grupo
 * @param userId  - UUID do usuário autenticado (deve ser membro)
 */
export async function getGroupDetails(
  groupId: string,
  userId: string,
): Promise<Group & { memberCount: number; activeMissionCount: number; role: MemberRole }> {
  // Verifica membership antes de retornar detalhes
  const { role } = await requireMembership(groupId, userId);

  const [groupResult, memberCountResult, missionCountResult] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).single(),
    supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .or('expires_at.is.null,expires_at.gt.now()'),
  ]);

  if (groupResult.error || !groupResult.data) {
    throw new AppError('Grupo não encontrado.', 404, 'GRUPO_NAO_ENCONTRADO');
  }

  return {
    ...mapGroupRow(groupResult.data as GroupRow),
    role,
    memberCount:        memberCountResult.count ?? 0,
    activeMissionCount: missionCountResult.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Listagem de membros
// ---------------------------------------------------------------------------

export interface GroupMemberWithStats {
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

/**
 * Retorna os membros do grupo com suas estatísticas de gamificação.
 * Apenas membros podem ver a lista.
 *
 * @param groupId - UUID do grupo
 * @param userId  - UUID do usuário autenticado
 */
export async function getGroupMembers(
  groupId: string,
  userId: string,
): Promise<GroupMemberWithStats[]> {
  await requireMembership(groupId, userId);

  const { data, error } = await supabase
    .from('group_members')
    .select(`
      user_id, role, joined_at,
      profiles (
        username, avatar_url, level, total_points, current_streak, longest_streak
      )
    `)
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  if (error) {
    throw new AppError('Erro ao buscar membros.', 500, 'BUSCA_FALHOU');
  }

  return (data ?? []).map((row) => {
    const r = row as {
      user_id: string; role: string; joined_at: string;
      profiles: ProfileRow;
    };
    return {
      userId:        r.user_id,
      role:          r.role as MemberRole,
      joinedAt:      r.joined_at,
      username:      r.profiles.username,
      avatarUrl:     r.profiles.avatar_url,
      level:         r.profiles.level,
      totalPoints:   r.profiles.total_points,
      currentStreak: r.profiles.current_streak,
      longestStreak: r.profiles.longest_streak,
    };
  });
}

// ---------------------------------------------------------------------------
// Atualização do grupo
// ---------------------------------------------------------------------------

/**
 * Atualiza as informações editáveis do grupo (nome, descrição, imagem).
 * Restrito a owner e admin.
 */
export async function updateGroup(
  groupId: string,
  userId: string,
  input: { name?: string; description?: string | null; imageUrl?: string | null },
): Promise<Group> {
  const { role } = await requireMembership(groupId, userId);

  if (role === MemberRole.Member) {
    throw new AppError('Apenas donos e admins podem editar o grupo.', 403, 'SEM_PERMISSAO');
  }

  const updates: Record<string, unknown> = {};
  if (input.name        !== undefined) updates['name']        = input.name;
  if (input.description !== undefined) updates['description'] = input.description;
  if (input.imageUrl    !== undefined) updates['image_url']   = input.imageUrl;

  if (Object.keys(updates).length === 0) {
    throw new AppError('Nenhum campo para atualizar.', 400, 'NADA_A_ATUALIZAR');
  }

  const { data, error } = await supabase
    .from('groups')
    .update(updates)
    .eq('id', groupId)
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError('Erro ao atualizar grupo.', 500, 'ATUALIZACAO_FALHOU');
  }

  return mapGroupRow(data as GroupRow);
}

/**
 * Gera um novo código de convite para o grupo.
 * Restrito a owner e admin.
 */
export async function regenerateInviteCode(
  groupId: string,
  userId: string,
): Promise<string> {
  const { role } = await requireMembership(groupId, userId);

  if (role === MemberRole.Member) {
    throw new AppError('Apenas donos e admins podem regenerar o código.', 403, 'SEM_PERMISSAO');
  }

  for (let i = 0; i < 5; i++) {
    const newCode = generateInviteCode(6);

    const { error } = await supabase
      .from('groups')
      .update({ invite_code: newCode })
      .eq('id', groupId);

    if (!error) return newCode;

    // 23505 = unique_violation; tenta outro código
    if (error.code !== '23505') {
      throw new AppError('Erro ao regenerar código de convite.', 500, 'REGENERACAO_FALHOU');
    }
  }

  throw new AppError('Não foi possível gerar um código único. Tente novamente.', 500);
}

// ---------------------------------------------------------------------------
// Gerenciamento de membros
// ---------------------------------------------------------------------------

/**
 * Altera o papel de um membro do grupo.
 * Apenas o owner pode mudar papéis. Não é permitido alterar o role do owner.
 */
export async function updateMemberRole(
  groupId: string,
  targetUserId: string,
  newRole: MemberRole.Admin | MemberRole.Member,
  requesterId: string,
): Promise<void> {
  const { role: requesterRole } = await requireMembership(groupId, requesterId);

  if (requesterRole !== MemberRole.Owner) {
    throw new AppError('Apenas o dono do grupo pode alterar papéis.', 403, 'SEM_PERMISSAO');
  }

  if (targetUserId === requesterId) {
    throw new AppError('Não é possível alterar o próprio papel.', 400, 'OPERACAO_INVALIDA');
  }

  const { data: targetRow } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (!targetRow) {
    throw new AppError('Membro não encontrado.', 404, 'MEMBRO_NAO_ENCONTRADO');
  }

  if ((targetRow as { role: string }).role === 'owner') {
    throw new AppError('Não é possível alterar o papel do dono do grupo.', 400, 'OPERACAO_INVALIDA');
  }

  const { error } = await supabase
    .from('group_members')
    .update({ role: newRole })
    .eq('group_id', groupId)
    .eq('user_id', targetUserId);

  if (error) {
    throw new AppError('Erro ao atualizar papel do membro.', 500, 'ATUALIZACAO_FALHOU');
  }
}

/**
 * Remove um membro do grupo (kick).
 * Owner/admin pode remover membros comuns; owner pode remover admins.
 * O owner não pode ser removido.
 */
export async function removeMember(
  groupId: string,
  targetUserId: string,
  requesterId: string,
): Promise<void> {
  const { role: requesterRole } = await requireMembership(groupId, requesterId);

  if (requesterRole === MemberRole.Member) {
    throw new AppError('Apenas donos e admins podem remover membros.', 403, 'SEM_PERMISSAO');
  }

  if (targetUserId === requesterId) {
    throw new AppError('Use "sair do grupo" para se remover.', 400, 'OPERACAO_INVALIDA');
  }

  const { data: targetRow } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (!targetRow) {
    throw new AppError('Membro não encontrado.', 404, 'MEMBRO_NAO_ENCONTRADO');
  }

  const targetRole = (targetRow as { role: string }).role;

  if (targetRole === 'owner') {
    throw new AppError('Não é possível remover o dono do grupo.', 400, 'OPERACAO_INVALIDA');
  }

  if (requesterRole === MemberRole.Admin && targetRole === 'admin') {
    throw new AppError('Admins não podem remover outros admins.', 403, 'SEM_PERMISSAO');
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', targetUserId);

  if (error) {
    throw new AppError('Erro ao remover membro.', 500, 'REMOCAO_FALHOU');
  }
}

/**
 * Remove o próprio usuário do grupo (sair).
 * O owner não pode sair — deve excluir o grupo.
 */
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { role } = await requireMembership(groupId, userId);

  if (role === MemberRole.Owner) {
    throw new AppError(
      'O dono não pode sair do grupo. Exclua o grupo ou transfira a posse.',
      400,
      'OWNER_NAO_PODE_SAIR',
    );
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    throw new AppError('Erro ao sair do grupo.', 500, 'SAIDA_FALHOU');
  }
}

/**
 * Exclui permanentemente o grupo e todos os seus dados (cascata via FK).
 * Restrito ao owner.
 */
export async function deleteGroup(groupId: string, userId: string): Promise<void> {
  const { role } = await requireMembership(groupId, userId);

  if (role !== MemberRole.Owner) {
    throw new AppError('Apenas o dono pode excluir o grupo.', 403, 'SEM_PERMISSAO');
  }

  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId);

  if (error) {
    throw new AppError('Erro ao excluir grupo.', 500, 'EXCLUSAO_FALHOU');
  }
}

// ---------------------------------------------------------------------------
// Ranking do grupo
// ---------------------------------------------------------------------------

export interface GroupRankingEntry extends RankingEntry {
  consistencyRate: number;
  rawScore:        number;
}

/**
 * Calcula o ranking interno de um grupo com pontuação multi-fator.
 *
 * Score = total_points × 0.5 + (streak × 10) × 0.3 + consistency_rate × 0.2
 * consistency_rate = (tarefas_concluídas / total_tarefas) × 100
 *
 * @param groupId - UUID do grupo
 * @param userId  - UUID do usuário autenticado (deve ser membro)
 */
export async function getGroupRanking(
  groupId: string,
  userId: string,
): Promise<GroupRankingEntry[]> {
  await requireMembership(groupId, userId);

  // Busca membros com perfis
  const members = await getGroupMembers(groupId, userId);
  if (members.length === 0) return [];

  const userIds = members.map((m) => m.userId);

  // Busca contagens de tarefas em paralelo (batch — não N+1)
  const [completedResult, totalResult] = await Promise.all([
    supabase
      .from('tasks')
      .select('user_id')
      .in('user_id', userIds)
      .eq('status', 'completed'),
    supabase
      .from('tasks')
      .select('user_id')
      .in('user_id', userIds),
  ]);

  // Agrega contagens por usuário em TypeScript
  const completedByUser = new Map<string, number>();
  const totalByUser     = new Map<string, number>();

  (completedResult.data ?? []).forEach((t) => {
    const uid = (t as { user_id: string }).user_id;
    completedByUser.set(uid, (completedByUser.get(uid) ?? 0) + 1);
  });

  (totalResult.data ?? []).forEach((t) => {
    const uid = (t as { user_id: string }).user_id;
    totalByUser.set(uid, (totalByUser.get(uid) ?? 0) + 1);
  });

  // Calcula score para cada membro e ordena
  const scored = members.map((member) => {
    const completed        = completedByUser.get(member.userId) ?? 0;
    const total            = totalByUser.get(member.userId)     ?? 0;
    const consistencyRate  = total > 0 ? (completed / total) * 100 : 0;
    const rawScore         = computeGroupScore(
      member.totalPoints,
      member.currentStreak,
      consistencyRate,
    );

    return { member, consistencyRate, rawScore };
  });

  scored.sort((a, b) => b.rawScore - a.rawScore);

  return scored.map(({ member, consistencyRate, rawScore }, index) => ({
    position:        index + 1,
    user: {
      id:        member.userId,
      username:  member.username,
      avatarUrl: member.avatarUrl,
      level:     member.level,
    },
    score:           rawScore,
    currentStreak:   member.currentStreak,
    consistencyRate: Math.round(consistencyRate * 10) / 10,
    rawScore,
  }));
}
