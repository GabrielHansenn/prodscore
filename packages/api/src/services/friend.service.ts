import {
  FriendshipStatus,
  type Friend,
  type FriendRequest,
  type FriendUser,
  type FriendRelation,
  type UserSearchResult,
} from '@prodscore/shared';
import { supabase } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Tipos internos (linhas do banco em snake_case)
// ---------------------------------------------------------------------------

interface FriendshipRow {
  id:           string;
  requester_id: string;
  addressee_id: string;
  status:       FriendshipStatus;
  created_at:   string;
  responded_at: string | null;
}

interface ProfileRow {
  id:             string;
  username:       string;
  avatar_url:     string | null;
  level:          number;
  total_points:   number;
  current_streak: number;
}

const PROFILE_COLUMNS = 'id, username, avatar_url, level, total_points, current_streak';

function mapProfile(row: ProfileRow): FriendUser {
  return {
    id:            row.id,
    username:      row.username,
    avatarUrl:     row.avatar_url,
    level:         row.level,
    totalPoints:   row.total_points,
    currentStreak: row.current_streak,
  };
}

/**
 * Busca perfis por lista de IDs e devolve um Map id → FriendUser.
 * friendships → profiles não tem FK (ambas referenciam auth.users), então o
 * embed implícito do PostgREST não funciona — mesmo padrão de dois passos
 * usado em group.service.ts para membros.
 */
async function fetchProfiles(ids: string[]): Promise<Map<string, FriendUser>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .in('id', unique);

  if (error) throw new AppError('Erro ao buscar usuários.', 500, 'BUSCA_FALHOU');

  return new Map((data as ProfileRow[]).map((p) => [p.id, mapProfile(p)]));
}

/** Vínculo existente entre dois usuários, em qualquer direção (ou null). */
async function findFriendship(a: string, b: string): Promise<FriendshipRow | null> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`and(requester_id.eq.${a},addressee_id.eq.${b}),and(requester_id.eq.${b},addressee_id.eq.${a})`)
    .maybeSingle();

  if (error) throw new AppError('Erro ao verificar amizade.', 500, 'BUSCA_FALHOU');
  return (data as FriendshipRow | null) ?? null;
}

/** Espelha a função SQL are_friends() — usada pela API, que contorna RLS. */
export async function areFriends(a: string, b: string): Promise<boolean> {
  const row = await findFriendship(a, b);
  return row?.status === FriendshipStatus.Accepted;
}

/** Garante amizade aceita entre os dois; senão lança 403. */
export async function assertAreFriends(a: string, b: string): Promise<void> {
  if (!(await areFriends(a, b))) {
    throw new AppError('Vocês precisam ser amigos para isso.', 403, 'NAO_SAO_AMIGOS');
  }
}

function relationFor(viewerId: string, row: FriendshipRow | null): FriendRelation {
  if (!row) return 'none';
  const iAmRequester = row.requester_id === viewerId;
  switch (row.status) {
    case FriendshipStatus.Accepted: return 'friends';
    case FriendshipStatus.Pending:  return iAmRequester ? 'request_sent' : 'request_received';
    case FriendshipStatus.Declined: return iAmRequester ? 'declined_by_them' : 'declined_by_me';
  }
}

// ---------------------------------------------------------------------------
// Busca de usuários
// ---------------------------------------------------------------------------

/**
 * Busca usuários por username (prefixo, case-insensitive), excluindo o
 * próprio usuário, e anexa a relação atual com cada um.
 */
export async function searchUsers(viewerId: string, query: string): Promise<UserSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  // Escapa curingas do LIKE pra busca literal
  const pattern = `${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .ilike('username', pattern)
    .neq('id', viewerId)
    .order('username')
    .limit(10);

  if (error) throw new AppError('Erro ao buscar usuários.', 500, 'BUSCA_FALHOU');

  const profiles = data as ProfileRow[];
  if (profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);
  const { data: links, error: linksError } = await supabase
    .from('friendships')
    .select('*')
    .or(
      `and(requester_id.eq.${viewerId},addressee_id.in.(${ids.join(',')})),` +
      `and(addressee_id.eq.${viewerId},requester_id.in.(${ids.join(',')}))`,
    );

  if (linksError) throw new AppError('Erro ao buscar usuários.', 500, 'BUSCA_FALHOU');

  const linkByOther = new Map<string, FriendshipRow>();
  for (const row of (links ?? []) as FriendshipRow[]) {
    const other = row.requester_id === viewerId ? row.addressee_id : row.requester_id;
    linkByOther.set(other, row);
  }

  return profiles.map((p) => {
    const row = linkByOther.get(p.id) ?? null;
    return { user: mapProfile(p), relation: relationFor(viewerId, row), friendshipId: row?.id ?? null };
  });
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

/**
 * Envia um pedido de amizade. Se já existe um pedido recusado feito por mim,
 * ele é substituído por um novo pending (DELETE + INSERT — coerente com a
 * RLS, que só deixa o addressee alterar status).
 */
export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<FriendRequest> {
  if (requesterId === addresseeId) {
    throw new AppError('Você não pode adicionar a si mesmo.', 400, 'AUTO_AMIZADE');
  }

  const profiles = await fetchProfiles([requesterId, addresseeId]);
  const addressee = profiles.get(addresseeId);
  if (!addressee) throw new AppError('Usuário não encontrado.', 404, 'USUARIO_NAO_ENCONTRADO');

  const existing = await findFriendship(requesterId, addresseeId);
  if (existing) {
    switch (existing.status) {
      case FriendshipStatus.Accepted:
        throw new AppError('Vocês já são amigos.', 409, 'JA_AMIGOS');
      case FriendshipStatus.Pending:
        throw new AppError(
          existing.requester_id === requesterId
            ? 'Você já enviou um pedido para este usuário.'
            : 'Este usuário já te enviou um pedido — responda a ele.',
          409,
          'PEDIDO_JA_EXISTE',
        );
      case FriendshipStatus.Declined:
        if (existing.requester_id !== requesterId) {
          // Recusei o pedido dele; se mudei de ideia, basta reabrir do meu lado
          throw new AppError('Você recusou o pedido deste usuário. Peça a ele para enviar novamente.', 409, 'RECUSADO_POR_MIM');
        }
        await supabase.from('friendships').delete().eq('id', existing.id);
    }
  }

  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: FriendshipStatus.Pending })
    .select('*')
    .single();

  if (error || !data) throw new AppError('Erro ao enviar pedido de amizade.', 500, 'PEDIDO_FALHOU');

  return mapRequest(data as FriendshipRow, profiles);
}

function mapRequest(row: FriendshipRow, profiles: Map<string, FriendUser>): FriendRequest {
  const requester = profiles.get(row.requester_id);
  const addressee = profiles.get(row.addressee_id);
  if (!requester || !addressee) throw new AppError('Erro ao montar pedido.', 500);
  return { id: row.id, requester, addressee, status: row.status, createdAt: row.created_at };
}

/** Pedidos pendentes recebidos ou enviados pelo usuário. */
export async function listFriendRequests(
  userId: string,
  direction: 'received' | 'sent',
): Promise<FriendRequest[]> {
  const column = direction === 'received' ? 'addressee_id' : 'requester_id';

  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq(column, userId)
    .eq('status', FriendshipStatus.Pending)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('Erro ao buscar pedidos.', 500, 'BUSCA_FALHOU');

  const rows = data as FriendshipRow[];
  const profiles = await fetchProfiles(rows.flatMap((r) => [r.requester_id, r.addressee_id]));
  return rows.map((r) => mapRequest(r, profiles));
}

async function getPendingRequestForAddressee(requestId: string, userId: string): Promise<FriendshipRow> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();

  if (error) throw new AppError('Erro ao buscar pedido.', 500, 'BUSCA_FALHOU');
  const row = data as FriendshipRow | null;
  if (!row) throw new AppError('Pedido não encontrado.', 404, 'PEDIDO_NAO_ENCONTRADO');
  if (row.addressee_id !== userId) {
    throw new AppError('Só o destinatário pode responder a este pedido.', 403, 'ACESSO_NEGADO');
  }
  if (row.status !== FriendshipStatus.Pending) {
    throw new AppError('Este pedido já foi respondido.', 409, 'PEDIDO_JA_RESPONDIDO');
  }
  return row;
}

/** Aceita (accepted) ou recusa (declined) um pedido recebido. */
export async function respondFriendRequest(
  requestId: string,
  userId: string,
  accept: boolean,
): Promise<FriendRequest> {
  await getPendingRequestForAddressee(requestId, userId);

  const { data, error } = await supabase
    .from('friendships')
    .update({
      status:       accept ? FriendshipStatus.Accepted : FriendshipStatus.Declined,
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('*')
    .single();

  if (error || !data) throw new AppError('Erro ao responder pedido.', 500, 'RESPOSTA_FALHOU');

  const row = data as FriendshipRow;
  const profiles = await fetchProfiles([row.requester_id, row.addressee_id]);
  return mapRequest(row, profiles);
}

// ---------------------------------------------------------------------------
// Amigos
// ---------------------------------------------------------------------------

/** Amizades aceitas, já resolvidas para "o outro lado". */
export async function listFriends(userId: string): Promise<Friend[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('status', FriendshipStatus.Accepted)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

  if (error) throw new AppError('Erro ao buscar amigos.', 500, 'BUSCA_FALHOU');

  const rows = data as FriendshipRow[];
  const otherIds = rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id));
  const profiles = await fetchProfiles(otherIds);

  return rows
    .map((r) => {
      const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id;
      const user = profiles.get(otherId);
      if (!user) return null;
      return { friendshipId: r.id, user, since: r.responded_at ?? r.created_at };
    })
    .filter((f): f is Friend => f !== null)
    .sort((a, b) => a.user.username.localeCompare(b.user.username, 'pt-BR'));
}

/**
 * Remove o vínculo com outro usuário — desfaz amizade aceita ou cancela um
 * pedido pendente enviado por mim. Qualquer um dos dois lados pode remover.
 */
export async function removeFriendship(userId: string, otherUserId: string): Promise<void> {
  const row = await findFriendship(userId, otherUserId);
  if (!row) throw new AppError('Vínculo não encontrado.', 404, 'AMIZADE_NAO_ENCONTRADA');

  const { error } = await supabase.from('friendships').delete().eq('id', row.id);
  if (error) throw new AppError('Erro ao remover amizade.', 500, 'REMOCAO_FALHOU');
}
