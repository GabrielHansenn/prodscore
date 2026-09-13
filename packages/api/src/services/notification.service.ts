import { NotificationType, type Notification } from '@prodscore/shared';
import { supabase } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';

interface NotificationRow {
  id:         string;
  user_id:    string;
  type:       NotificationType;
  title:      string;
  body:       string | null;
  actor_id:   string | null;
  entity_id:  string | null;
  read_at:    string | null;
  created_at: string;
}

const COLUMNS   = 'id, user_id, type, title, body, actor_id, entity_id, read_at, created_at';
const PAGE_SIZE = 30;

function mapNotification(row: NotificationRow): Notification {
  return {
    id:        row.id,
    type:      row.type,
    title:     row.title,
    body:      row.body,
    actorId:   row.actor_id,
    entityId:  row.entity_id,
    readAt:    row.read_at,
    createdAt: row.created_at,
  };
}

interface CreateNotificationInput {
  userId:   string;
  type:     NotificationType;
  title:    string;
  body?:    string | null;
  actorId?: string | null;
  entityId?: string | null;
}

/**
 * Cria uma notificação para um usuário.
 *
 * Nunca lança: notificação é efeito colateral de outra ação (concluir tarefa,
 * enviar mensagem) e não pode derrubar a operação principal se falhar — o erro
 * é registrado no log do servidor e a ação segue.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id:   input.userId,
      type:      input.type,
      title:     input.title,
      body:      input.body     ?? null,
      actor_id:  input.actorId  ?? null,
      entity_id: input.entityId ?? null,
    });

    if (error) {
      console.error('[notification.service.createNotification] falhou:', error, { type: input.type, userId: input.userId });
    }
  } catch (err) {
    console.error('[notification.service.createNotification] exceção:', err, { type: input.type, userId: input.userId });
  }
}

/** Corta a prévia da mensagem para caber no `body` sem cortar no meio de forma feia. */
function preview(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/**
 * Notificação de mensagem de chat, com AGRUPAMENTO: se já existe uma
 * notificação não lida da mesma origem (mesmo remetente no chat de amigos, ou
 * mesmo grupo no chat de grupo), atualiza aquela em vez de inserir outra —
 * 20 mensagens viram "20 novas mensagens", não 20 linhas no sino.
 *
 * O UPDATE mexe em created_at de propósito: a notificação sobe para o topo da
 * lista como a mais recente, e o Realtime emite um UPDATE que o cliente usa
 * para atualizar o item sem recarregar.
 */
export async function notifyChatMessage(input: {
  userId:   string;
  type:     NotificationType.FriendMessage | NotificationType.GroupMessage;
  /** Remetente (chat de amigos) — também usado no agrupamento */
  actorId:  string;
  /** Grupo (chat de grupo); null no chat de amigos */
  entityId: string | null;
  /** Nome exibido: username do remetente ou "fulano · Nome do grupo" */
  title:    string;
  /** Texto puro da mensagem (sem HTML) */
  messageText: string;
}): Promise<void> {
  try {
    await notifyChatMessageInner(input);
  } catch (err) {
    console.error('[notification.service.notifyChatMessage] exceção:', err, { type: input.type, userId: input.userId });
  }
}

/** Corpo de notifyChatMessage — separado para o try/catch acima cobrir tudo. */
async function notifyChatMessageInner(input: {
  userId:   string;
  type:     NotificationType.FriendMessage | NotificationType.GroupMessage;
  actorId:  string;
  entityId: string | null;
  title:    string;
  messageText: string;
}): Promise<void> {
  const groupingColumn = input.type === NotificationType.GroupMessage ? 'entity_id' : 'actor_id';
  const groupingValue  = input.type === NotificationType.GroupMessage ? input.entityId : input.actorId;

  let existingQuery = supabase
    .from('notifications')
    .select('id, body')
    .eq('user_id', input.userId)
    .eq('type', input.type)
    .is('read_at', null)
    .limit(1);

  existingQuery = groupingValue === null
    ? existingQuery.is(groupingColumn, null)
    : existingQuery.eq(groupingColumn, groupingValue);

  const { data: existing, error: findError } = await existingQuery.maybeSingle();

  if (findError) {
    console.error('[notification.service.notifyChatMessage] busca falhou:', findError);
    return;
  }

  if (existing) {
    const row = existing as { id: string; body: string | null };
    // Conta quantas já acumulou: o body vira "N novas mensagens" a partir da segunda
    const match = /^(\d+) novas mensagens/.exec(row.body ?? '');
    const count = match ? Number(match[1]) + 1 : 2;

    const { error } = await supabase
      .from('notifications')
      .update({
        title:      input.title,
        body:       `${count} novas mensagens · ${preview(input.messageText, 80)}`,
        actor_id:   input.actorId,
        created_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (error) console.error('[notification.service.notifyChatMessage] update falhou:', error);
    return;
  }

  await createNotification({
    userId:   input.userId,
    type:     input.type,
    title:    input.title,
    body:     preview(input.messageText),
    actorId:  input.actorId,
    entityId: input.entityId,
  });
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/** Notificações do usuário, mais recentes primeiro. `before` (ISO) pagina para trás. */
export async function listNotifications(
  userId: string,
  before?: string,
): Promise<{ notifications: Notification[]; hasMore: boolean }> {
  let query = supabase
    .from('notifications')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw new AppError('Erro ao carregar notificações.', 500, 'BUSCA_FALHOU');

  const rows    = data as NotificationRow[];
  const hasMore = rows.length > PAGE_SIZE;
  const page    = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return { notifications: page.map(mapNotification), hasMore };
}

/** Quantidade de notificações não lidas — alimenta o badge do sino. */
export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw new AppError('Erro ao contar notificações.', 500, 'BUSCA_FALHOU');
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Escrita pelo próprio usuário
// ---------------------------------------------------------------------------

/** Marca uma notificação como lida (ignora se já estava lida). */
export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .is('read_at', null)
    .select('id');

  if (error) throw new AppError('Erro ao marcar notificação como lida.', 500, 'ATUALIZACAO_FALHOU');

  // Nenhuma linha afetada: ou não existe, ou é de outro usuário, ou já estava lida.
  // Só diferenciamos "não é sua" de "já lida" para não vazar existência.
  if ((data ?? []).length === 0) {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('id', notificationId)
      .eq('user_id', userId);
    if ((count ?? 0) === 0) {
      throw new AppError('Notificação não encontrada.', 404, 'NOTIFICACAO_NAO_ENCONTRADA');
    }
  }
}

/** Marca todas as não lidas como lidas. Devolve quantas foram marcadas. */
export async function markAllAsRead(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
    .select('id');

  if (error) throw new AppError('Erro ao marcar notificações como lidas.', 500, 'ATUALIZACAO_FALHOU');
  return (data ?? []).length;
}

/** Remove todas as notificações do usuário (limpar histórico). */
export async function clearAll(userId: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('user_id', userId);
  if (error) throw new AppError('Erro ao limpar notificações.', 500, 'REMOCAO_FALHOU');
}
