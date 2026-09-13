import { randomUUID } from 'node:crypto';
import {
  NotificationType,
  MAX_RICH_TEXT_LENGTH,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
  normalizeRichText,
  richTextToPlainText,
  type GroupMessage,
  type RichTextDoc,
} from '@prodscore/shared';
import { supabase } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';
import { detectDisplayImageType, extensionForDisplayImageType } from '../lib/imageSniff.js';
import { requireMembership } from './group.service.js';
import { notifyChatMessage } from './notification.service.js';

const BUCKET = 'group-chat';
/** Validade da URL assinada da imagem — curta de propósito (bucket privado) */
const SIGNED_URL_TTL_SECONDS = 10 * 60;
const PAGE_SIZE = 40;

interface GroupMessageRow {
  id:           string;
  group_id:     string;
  sender_id:    string;
  content:      unknown;
  content_text: string;
  image_path:   string | null;
  created_at:   string;
}

interface SenderProfile {
  id:         string;
  username:   string;
  avatar_url: string | null;
}

/**
 * Gera URLs assinadas em lote para os paths informados.
 * O bucket é privado: sem isso a imagem não abre no cliente.
 */
async function signImagePaths(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    console.error('[groupMessage.service.signImagePaths] falhou:', error);
    return new Map();
  }

  const map = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}

/** Busca os perfis dos remetentes (group_messages → profiles não tem FK; join em JS) */
async function fetchSenders(ids: string[]): Promise<Map<string, SenderProfile>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', unique);

  if (error) throw new AppError('Erro ao carregar mensagens.', 500, 'BUSCA_FALHOU');
  return new Map((data as SenderProfile[]).map((p) => [p.id, p]));
}

function mapMessage(
  row: GroupMessageRow,
  senders: Map<string, SenderProfile>,
  signedUrls: Map<string, string>,
): GroupMessage {
  const sender = senders.get(row.sender_id);
  return {
    id:      row.id,
    groupId: row.group_id,
    sender: {
      id:        row.sender_id,
      username:  sender?.username  ?? 'Usuário',
      avatarUrl: sender?.avatar_url ?? null,
    },
    content:     (row.content as RichTextDoc | null) ?? null,
    contentText: row.content_text,
    imageUrl:    row.image_path ? signedUrls.get(row.image_path) ?? null : null,
    createdAt:   row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/** Histórico do grupo, do mais antigo para o mais novo. `before` (ISO) pagina para trás. */
export async function listGroupMessages(
  groupId: string,
  userId: string,
  before?: string,
): Promise<{ messages: GroupMessage[]; hasMore: boolean }> {
  await requireMembership(groupId, userId);

  let query = supabase
    .from('group_messages')
    .select('id, group_id, sender_id, content, content_text, image_path, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw new AppError('Erro ao carregar mensagens.', 500, 'BUSCA_FALHOU');

  const rows    = data as GroupMessageRow[];
  const hasMore = rows.length > PAGE_SIZE;
  const page    = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).reverse();

  const [senders, signedUrls] = await Promise.all([
    fetchSenders(page.map((r) => r.sender_id)),
    signImagePaths(page.filter((r) => r.image_path).map((r) => r.image_path as string)),
  ]);

  return { messages: page.map((r) => mapMessage(r, senders, signedUrls)), hasMore };
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

/**
 * Envia uma mensagem no chat do grupo e notifica os demais membros.
 *
 * O documento de texto rico passa por `normalizeRichText`, que o reconstrói a
 * partir de uma allowlist de tipos/marcas — é a fronteira de segurança do
 * conteúdo (nada que venha do cliente é armazenado como veio).
 */
export async function sendGroupMessage(
  groupId: string,
  senderId: string,
  input: { content?: unknown; imagePath?: string | null },
): Promise<GroupMessage> {
  await requireMembership(groupId, senderId);

  const doc  = input.content === undefined || input.content === null ? null : normalizeRichText(input.content);
  const text = doc ? richTextToPlainText(doc) : '';

  if (text.length > MAX_RICH_TEXT_LENGTH) {
    throw new AppError(`A mensagem deve ter no máximo ${MAX_RICH_TEXT_LENGTH} caracteres.`, 400, 'MENSAGEM_MUITO_LONGA');
  }

  const imagePath = input.imagePath ?? null;
  if (text.length === 0 && !imagePath) {
    throw new AppError('A mensagem não pode estar vazia.', 400, 'MENSAGEM_VAZIA');
  }

  // A imagem precisa ter sido enviada para ESTE grupo (o path começa com o id dele)
  if (imagePath && !imagePath.startsWith(`${groupId}/`)) {
    throw new AppError('Imagem inválida para este grupo.', 400, 'IMAGEM_INVALIDA');
  }

  const { data, error } = await supabase
    .from('group_messages')
    .insert({
      group_id:     groupId,
      sender_id:    senderId,
      content:      text.length > 0 ? doc : null,
      content_text: text,
      image_path:   imagePath,
    })
    .select('id, group_id, sender_id, content, content_text, image_path, created_at')
    .single();

  if (error || !data) {
    console.error('[groupMessage.service.sendGroupMessage] insert falhou:', error);
    throw new AppError('Erro ao enviar mensagem.', 500, 'ENVIO_FALHOU');
  }

  const row = data as GroupMessageRow;
  const [senders, signedUrls] = await Promise.all([
    fetchSenders([senderId]),
    signImagePaths(imagePath ? [imagePath] : []),
  ]);

  await notifyGroupMembers(groupId, senderId, senders.get(senderId)?.username ?? 'Alguém', text || 'enviou uma imagem');

  return mapMessage(row, senders, signedUrls);
}

/** Notifica todos os membros do grupo, menos quem enviou. */
async function notifyGroupMembers(
  groupId: string,
  senderId: string,
  senderUsername: string,
  messageText: string,
): Promise<void> {
  const [{ data: members }, { data: group }] = await Promise.all([
    supabase.from('group_members').select('user_id').eq('group_id', groupId).neq('user_id', senderId),
    supabase.from('groups').select('name').eq('id', groupId).maybeSingle(),
  ]);

  const groupName = (group as { name: string } | null)?.name ?? 'Grupo';

  await Promise.all(
    ((members ?? []) as { user_id: string }[]).map((m) =>
      notifyChatMessage({
        userId:      m.user_id,
        type:        NotificationType.GroupMessage,
        actorId:     senderId,
        entityId:    groupId,
        title:       `${senderUsername} · ${groupName}`,
        messageText,
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Imagem
// ---------------------------------------------------------------------------

/**
 * Sobe uma imagem para o bucket privado do chat e devolve o path + URL
 * assinada. O path é enviado depois junto da mensagem (sendGroupMessage
 * confere se pertence ao grupo).
 */
export async function uploadGroupChatImage(
  groupId: string,
  userId: string,
  buffer: Buffer,
): Promise<{ imagePath: string; imageUrl: string }> {
  await requireMembership(groupId, userId);

  if (buffer.length === 0) throw new AppError('Arquivo vazio.', 400, 'ARQUIVO_INVALIDO');
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new AppError(`A imagem deve ter no máximo ${MAX_IMAGE_SIZE_MB} MB.`, 400, 'ARQUIVO_MUITO_GRANDE');
  }

  const contentType = detectDisplayImageType(buffer);
  if (!contentType) {
    throw new AppError('Formato de imagem inválido. Envie um arquivo JPEG, PNG, WebP ou GIF.', 400, 'FORMATO_INVALIDO');
  }

  const imagePath = `${groupId}/${randomUUID()}.${extensionForDisplayImageType(contentType)}`;

  const { error } = await supabase.storage.from(BUCKET).upload(imagePath, buffer, { contentType, upsert: false });
  if (error) {
    console.error('[groupMessage.service.uploadGroupChatImage] upload falhou:', error, { imagePath });
    throw new AppError('Erro ao enviar a imagem. Tente novamente.', 500, 'UPLOAD_FALHOU');
  }

  const signed = await signImagePaths([imagePath]);
  return { imagePath, imageUrl: signed.get(imagePath) ?? '' };
}

// ---------------------------------------------------------------------------
// Mensagens novas (marcador por membro)
// ---------------------------------------------------------------------------

/** Marca o chat do grupo como lido até agora. */
export async function markGroupChatRead(groupId: string, userId: string): Promise<void> {
  await requireMembership(groupId, userId);

  const { error } = await supabase
    .from('group_message_reads')
    .upsert(
      { group_id: groupId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: 'group_id,user_id' },
    );

  if (error) throw new AppError('Erro ao marcar mensagens como lidas.', 500, 'ATUALIZACAO_FALHOU');
}

/**
 * Quantidade de mensagens não lidas no chat do grupo (mensagens de outros
 * membros criadas depois do marcador `last_read_at`).
 */
export async function getGroupUnreadCount(groupId: string, userId: string): Promise<number> {
  const { data: readRow } = await supabase
    .from('group_message_reads')
    .select('last_read_at')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  let query = supabase
    .from('group_messages')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .neq('sender_id', userId);

  const lastReadAt = (readRow as { last_read_at: string } | null)?.last_read_at;
  if (lastReadAt) query = query.gt('created_at', lastReadAt);

  const { count, error } = await query;
  if (error) throw new AppError('Erro ao contar mensagens.', 500, 'BUSCA_FALHOU');
  return count ?? 0;
}
