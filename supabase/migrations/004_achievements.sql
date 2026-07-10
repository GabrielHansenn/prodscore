-- Migration: 004_achievements
-- Descrição: Catálogo de conquistas da plataforma e registro das desbloqueadas por usuário.
--             O catálogo é gerenciado exclusivamente pelo backend (service_role).
--             Desbloqueios são imutáveis: somente INSERT, nunca UPDATE/DELETE.

CREATE TABLE public.achievements (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 1 AND 100),
  description    TEXT        NOT NULL,
  -- Chave do ícone — emoji (ex: '🔥') ou identificador de asset
  icon           TEXT        NOT NULL DEFAULT '🏆',
  reward_points  INTEGER     NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  -- Critério armazenado como metadado para verificação programática no backend
  -- Ex: {"type":"streak","threshold":7} ou {"type":"tasks_completed","threshold":10}
  criteria       JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registro de conquistas desbloqueadas por usuário (append-only, sem updates)
CREATE TABLE public.user_achievements (
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID        NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user_id        ON public.user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON public.user_achievements(achievement_id);
CREATE INDEX idx_achievements_criteria            ON public.achievements USING GIN (criteria);

-- ---------------------------------------------------------------------------
-- Row Level Security — achievements (catálogo)
-- ---------------------------------------------------------------------------
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Catálogo visível para todos os usuários autenticados
CREATE POLICY "achievements_select_authenticated"
  ON public.achievements FOR SELECT
  TO authenticated
  USING (true);

-- Apenas service_role (backend) pode criar conquistas no catálogo
-- (service_role bypassa RLS; policy existe para documentar a intenção e bloquear clientes)
CREATE POLICY "achievements_insert_service_role"
  ON public.achievements FOR INSERT
  WITH CHECK (false);

CREATE POLICY "achievements_update_service_role"
  ON public.achievements FOR UPDATE
  USING (false);

CREATE POLICY "achievements_delete_service_role"
  ON public.achievements FOR DELETE
  USING (false);

-- ---------------------------------------------------------------------------
-- Row Level Security — user_achievements (desbloqueios)
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Conquistas desbloqueadas são visíveis para todos os autenticados (recurso social/ranking)
CREATE POLICY "user_achievements_select_authenticated"
  ON public.user_achievements FOR SELECT
  TO authenticated
  USING (true);

-- Apenas o backend (service_role) registra conquistas desbloqueadas
CREATE POLICY "user_achievements_insert_service_role"
  ON public.user_achievements FOR INSERT
  WITH CHECK (false);

-- Desbloqueios são imutáveis — nenhuma atualização ou exclusão permitida
CREATE POLICY "user_achievements_no_update"
  ON public.user_achievements FOR UPDATE
  USING (false);

CREATE POLICY "user_achievements_no_delete"
  ON public.user_achievements FOR DELETE
  USING (false);
