import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { Message } from '@prodscore/shared';

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
