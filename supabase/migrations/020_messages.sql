-- Migration: 020_messages
-- Descrição: Chat 1:1 entre amigos, em tempo real via Supabase Realtime.
--
-- Não há tabela de "conversa": num chat 1:1 a conversa É o par de usuários
-- (sender, receiver), em qualquer direção. "Mensagem nova" = read_at IS NULL
-- e receiver_id = eu.
--
-- Realtime: a tabela entra na publication supabase_realtime e o Realtime só
-- entrega ao assinante as linhas que a policy de SELECT dele permite — ou seja,
-- cada usuário recebe apenas mensagens das quais participa. O envio é feito
-- pela API (valida amizade e tamanho); o Realtime é só o caminho de RECEBER.
--
-- Amizade desfeita: as mensagens ficam no banco, mas a policy de SELECT exige
-- are_friends() — o histórico fica inacessível para os dois até que voltem a
-- ser amigos (decisão do plano: bloquear, não apagar).

CREATE TABLE public.messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at      TIMESTAMPTZ,

  CONSTRAINT messages_no_self CHECK (sender_id <> receiver_id)
);

-- Histórico de uma conversa (consulta pelos dois pares ordenados, em qualquer direção)
CREATE INDEX idx_messages_pair_created
  ON public.messages (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC);

-- Contagem de não lidas por remetente (só o que interessa: read_at IS NULL)
CREATE INDEX idx_messages_unread
  ON public.messages (receiver_id, sender_id) WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- A API (service_role) contorna RLS e reaplica estas regras em código
-- (message.service.ts); as policies protegem o acesso direto do client e são
-- o que o Realtime usa para filtrar o que cada assinante recebe.
-- ---------------------------------------------------------------------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Participante da conversa E ainda amigos (histórico bloqueado após desfazer amizade)
CREATE POLICY "messages_select_participant_friends"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (sender_id, receiver_id)
    AND public.are_friends(sender_id, receiver_id)
  );

-- Só se envia em nome próprio, e só para amigos
CREATE POLICY "messages_insert_sender_friends"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.are_friends(sender_id, receiver_id)
  );

-- Só o destinatário altera (marcar como lida)
CREATE POLICY "messages_update_receiver"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- Sem DELETE: histórico imutável (mesma abordagem de point_transactions)
