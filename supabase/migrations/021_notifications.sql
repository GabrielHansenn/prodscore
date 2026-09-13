-- Migration: 021_notifications
-- Descrição: Central de notificações (sino) — eventos do sistema persistidos
--             por usuário, com estado de lida/não lida e entrega em tempo real.
--
-- Tipos cobertos:
--   friend_message → nova mensagem no chat de amigos
--   group_message  → nova mensagem no chat de grupo (Feature 2)
--   achievement    → conquista desbloqueada
--   level_up       → subiu de nível
--
-- title/body são desnormalizados de propósito: o painel do sino abre sem
-- precisar de join com profiles/achievements/groups a cada notificação.
--
-- Agrupamento de chat: o service reaproveita a notificação NÃO LIDA do mesmo
-- (user_id, type, actor_id/entity_id) em vez de inserir uma por mensagem —
-- 20 mensagens viram "20 novas mensagens", não 20 linhas. Daí o índice
-- parcial idx_notifications_group_unread.

CREATE TYPE public.notification_type AS ENUM (
  'friend_message',
  'group_message',
  'achievement',
  'level_up'
);

CREATE TABLE public.notifications (
  id          UUID                      PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dono da notificação (quem vê no sino)
  user_id     UUID                      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        public.notification_type  NOT NULL,
  title       TEXT                      NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body        TEXT                      CHECK (char_length(body) <= 300),
  -- Quem causou o evento (remetente da mensagem) — NULL em conquista/nível
  actor_id    UUID                      REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Entidade de destino do clique (group_id, achievement_id, …) — sem FK porque varia por tipo
  entity_id   UUID,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ               NOT NULL DEFAULT NOW()
);

-- Listagem do painel (mais recentes primeiro)
CREATE INDEX idx_notifications_user_recent
  ON public.notifications(user_id, created_at DESC);

-- Contador do sino
CREATE INDEX idx_notifications_unread
  ON public.notifications(user_id) WHERE read_at IS NULL;

-- Busca da notificação de chat não lida a ser reaproveitada (agrupamento)
CREATE INDEX idx_notifications_group_unread
  ON public.notifications(user_id, type, actor_id, entity_id) WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Só a API (service_role) cria notificações — não há policy de INSERT de
-- propósito: nenhum cliente pode forjar notificação para si ou para outro.
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Cada um vê apenas as próprias (é também o filtro que o Realtime aplica)
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Marcar como lida
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Limpar o histórico
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
