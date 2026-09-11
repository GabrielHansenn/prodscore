import { MAX_MESSAGE_LENGTH, type Message } from '@prodscore/shared';
import { supabase } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';
import { assertAreFriends } from './friend.service.js';

interface MessageRow {
  id:          string;
  sender_id:   string;
  receiver_id: string;
  content:     string;
  created_at:  string;
  read_at:     string | null;
}

const MESSAGE_COLUMNS = 'id, sender_id, receiver_id, content, created_at, read_at';
const PAGE_SIZE       = 50;

export function mapMessage(row: MessageRow): Message {
  return {
    id:         row.id,
    senderId:   row.sender_id,
    receiverId: row.receiver_id,
    content:    row.content,
    createdAt:  row.created_at,
    readAt:     row.read_at,
  };
}

/**
 * Histórico da conversa entre dois amigos, do mais antigo para o mais novo.
 * Paginação por cursor: `before` (ISO) devolve as PAGE_SIZE mensagens
 * anteriores àquele instante — usado pelo "carregar mais antigas".
 */
export async function listMessages(
  userId: string,
  friendId: string,
  before?: string,
): Promise<{ messages: Message[]; hasMore: boolean }> {
  await assertAreFriends(userId, friendId);

  let query = supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw new AppError('Erro ao carregar mensagens.', 500, 'BUSCA_FALHOU');

  const rows = (data as MessageRow[]);
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return { messages: page.reverse().map(mapMessage), hasMore };
}

/** Envia uma mensagem para um amigo. */
export async function sendMessage(senderId: string, receiverId: string, rawContent: string): Promise<Message> {
  const content = rawContent.trim();
  if (!content) throw new AppError('A mensagem não pode estar vazia.', 400, 'MENSAGEM_VAZIA');
  if (content.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(`A mensagem deve ter no máximo ${MAX_MESSAGE_LENGTH} caracteres.`, 400, 'MENSAGEM_MUITO_LONGA');
  }
  if (senderId === receiverId) throw new AppError('Você não pode enviar mensagem para si mesmo.', 400, 'AUTO_MENSAGEM');

  await assertAreFriends(senderId, receiverId);

  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error || !data) {
    console.error('[message.service.sendMessage] insert falhou:', error);
    throw new AppError('Erro ao enviar mensagem.', 500, 'ENVIO_FALHOU');
  }
  return mapMessage(data as MessageRow);
}

/** Marca como lidas todas as mensagens recebidas de um amigo. Devolve quantas foram marcadas. */
export async function markConversationRead(userId: string, friendId: string): Promise<number> {
  await assertAreFriends(userId, friendId);

  const { data, error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('receiver_id', userId)
    .eq('sender_id', friendId)
    .is('read_at', null)
    .select('id');

  if (error) throw new AppError('Erro ao marcar mensagens como lidas.', 500, 'ATUALIZACAO_FALHOU');
  return (data ?? []).length;
}

/** Não lidas por remetente: { [senderId]: quantidade } — para os badges na lista de amigos. */
export async function getUnreadCounts(userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('messages')
    .select('sender_id')
    .eq('receiver_id', userId)
    .is('read_at', null);

  if (error) throw new AppError('Erro ao buscar mensagens não lidas.', 500, 'BUSCA_FALHOU');

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { sender_id: string }[]) {
    counts[row.sender_id] = (counts[row.sender_id] ?? 0) + 1;
  }
  return counts;
}
