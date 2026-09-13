import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Message, Notification, NotificationType } from '@prodscore/shared';

/**
 * Cliente Supabase do mobile — usado EXCLUSIVAMENTE para o canal Realtime do
 * chat. Todo CRUD e autenticação continuam passando pela API (padrão do app);
 * este client existe porque o Realtime é uma conexão WebSocket direta com o
 * Supabase e não há como a API "repassar" isso sem reimplementar o transporte.
 *
 * Sem persistência de sessão: a autenticação é feita por requisição com o
 * mesmo JWT que o app já guarda no SecureStore (`realtime.setAuth(token)`),
 * o que faz o Realtime aplicar as policies de RLS de `messages` ao assinante.
 */
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const url  = process.env['EXPO_PUBLIC_SUPABASE_URL'];
  const anon = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'];
  if (!url || !anon) {
    throw new Error('[realtime] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY não definidas no .env do mobile.');
  }
  client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

interface MessageRow {
  id:          string;
  sender_id:   string;
  receiver_id: string;
  content:     string;
  created_at:  string;
  read_at:     string | null;
}

function mapRow(row: MessageRow): Message {
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
 * Assina as mensagens enviadas PARA `userId` (INSERT em public.messages com
 * receiver_id = userId). Devolve a função que encerra a assinatura.
 */
export function subscribeIncomingMessages(
  userId: string,
  accessToken: string,
  onMessage: (message: Message) => void,
): () => void {
  const supabase = getClient();
  supabase.realtime.setAuth(accessToken);

  const channel: RealtimeChannel = supabase
    .channel(`messages:${userId}:${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
      (payload) => onMessage(mapRow(payload.new as MessageRow)),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Notificações (sino)
// ---------------------------------------------------------------------------

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

function mapNotificationRow(row: NotificationRow): Notification {
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

/**
 * Assina as notificações do usuário. Escuta INSERT e UPDATE: as notificações
 * de chat são agrupadas, então a segunda mensagem do mesmo remetente atualiza
 * a notificação existente em vez de criar outra.
 */
export function subscribeNotifications(
  userId: string,
  accessToken: string,
  handlers: { onInsert: (n: Notification) => void; onUpdate: (n: Notification) => void },
): () => void {
  const supabase = getClient();
  supabase.realtime.setAuth(accessToken);

  const channel: RealtimeChannel = supabase
    .channel(`notifications:${userId}:${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => handlers.onInsert(mapNotificationRow(payload.new as NotificationRow)),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => handlers.onUpdate(mapNotificationRow(payload.new as NotificationRow)),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Chat de grupo
// ---------------------------------------------------------------------------

/**
 * Assina os INSERTs de `group_messages` do grupo. O payload traz a linha crua
 * (sem perfil do remetente e sem URL assinada da imagem), então o handler
 * recebe só o id e a tela recarrega a página pela API.
 */
export function subscribeGroupMessages(
  groupId: string,
  accessToken: string,
  onNewMessage: (messageId: string) => void,
): () => void {
  const supabase = getClient();
  supabase.realtime.setAuth(accessToken);

  const channel: RealtimeChannel = supabase
    .channel(`group_messages:${groupId}:${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
      (payload) => onNewMessage((payload.new as { id: string }).id),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
