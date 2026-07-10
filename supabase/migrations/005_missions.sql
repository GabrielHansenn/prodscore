-- Migration: 005_missions
-- Descrição: Missões com objetivos e recompensas em pontos.
--             Missões individuais são visíveis a todos; missões de grupo apenas para membros.
--             O progresso (mission_participants) é atualizado pelo backend após cada tarefa concluída.

CREATE TYPE public.mission_type AS ENUM ('individual', 'group');

CREATE TABLE public.missions (
  id             UUID                NOT NULL DEFAULT gen_random_uuid(),
  title          TEXT                NOT NULL CHECK (char_length(title) BETWEEN 1 AND 255),
  description    TEXT                NOT NULL,
  type           public.mission_type NOT NULL DEFAULT 'individual',
  -- Nulo para missões individuais; obrigatório para missões de grupo
  group_id       UUID                REFERENCES public.groups(id) ON DELETE CASCADE,
  -- Valor numérico alvo (ex: 10 tarefas a completar)
  target_value   INTEGER             NOT NULL CHECK (target_value > 0),
  reward_points  INTEGER             NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id),
  -- Garante que missões de grupo sempre têm group_id
  CONSTRAINT chk_mission_group_id
    CHECK (
      (type = 'group'      AND group_id IS NOT NULL)
      OR (type = 'individual' AND group_id IS NULL)
    )
);

-- Progresso individual de cada participante em cada missão
CREATE TABLE public.mission_participants (
  mission_id    UUID        NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_value INTEGER     NOT NULL DEFAULT 0 CHECK (current_value >= 0),
  is_completed  BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (mission_id, user_id),

  -- Garante que completed_at só existe quando is_completed é TRUE
  CONSTRAINT chk_mission_completed_at
    CHECK (
      (is_completed = TRUE  AND completed_at IS NOT NULL)
      OR is_completed = FALSE
    )
);

CREATE INDEX idx_missions_type                  ON public.missions(type);
CREATE INDEX idx_missions_group_id              ON public.missions(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_missions_expires_at            ON public.missions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_mission_participants_user_id   ON public.mission_participants(user_id);
CREATE INDEX idx_mission_participants_completed ON public.mission_participants(is_completed)
  WHERE is_completed = FALSE;

-- ---------------------------------------------------------------------------
-- Row Level Security — missions
-- ---------------------------------------------------------------------------
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- Missões individuais visíveis para todos; missões de grupo apenas para membros
CREATE POLICY "missions_select_accessible"
  ON public.missions FOR SELECT
  TO authenticated
  USING (
    type = 'individual'
    OR (
      group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = missions.group_id
          AND gm.user_id  = auth.uid()
      )
    )
  );

-- Missões são criadas e gerenciadas exclusivamente pelo backend
CREATE POLICY "missions_write_service_role"
  ON public.missions FOR INSERT
  WITH CHECK (false);

CREATE POLICY "missions_update_service_role"
  ON public.missions FOR UPDATE
  USING (false);

CREATE POLICY "missions_delete_service_role"
  ON public.missions FOR DELETE
  USING (false);

-- ---------------------------------------------------------------------------
-- Row Level Security — mission_participants
-- ---------------------------------------------------------------------------
ALTER TABLE public.mission_participants ENABLE ROW LEVEL SECURITY;

-- Usuário vê o próprio progresso
-- Para missões de grupo, membros do grupo também veem o progresso dos colegas
CREATE POLICY "mission_participants_select"
  ON public.mission_participants FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.missions m
      JOIN public.group_members gm ON gm.group_id = m.group_id
      WHERE m.id         = mission_participants.mission_id
        AND m.type       = 'group'
        AND gm.user_id   = auth.uid()
    )
  );

-- Usuário pode entrar (fazer INSERT) em qualquer missão disponível para ele
CREATE POLICY "mission_participants_insert_own"
  ON public.mission_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_participants.mission_id
        AND (
          m.type = 'individual'
          OR EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = m.group_id
              AND gm.user_id  = auth.uid()
          )
        )
    )
  );

-- Apenas backend atualiza progresso (service_role bypassa; policy bloqueia cliente)
CREATE POLICY "mission_participants_update_service_role"
  ON public.mission_participants FOR UPDATE
  USING (false);

-- Participante pode sair de uma missão não concluída
CREATE POLICY "mission_participants_delete_own"
  ON public.mission_participants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_completed = FALSE);
