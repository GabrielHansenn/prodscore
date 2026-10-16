-- Migration: 026_adaptive_gamification
-- Descrição: Gamificação adaptativa — regras que se ajustam ao histórico de
--            cada usuário.
--
--   1. Meta semanal personalizada (weekly_goals): uma linha por usuário por
--      semana (segunda 00:00 UTC, mesmo recorte do ranking semanal). Criada
--      de forma preguiçosa pela API na primeira consulta da semana, com a
--      meta calculada a partir da média do próprio usuário. Ao bater a meta,
--      achieved_at é preenchido UMA vez e o bônus vira transação
--      'weekly_goal_reward'.
--   2. Bônus de retomada: transação 'comeback_bonus' na primeira tarefa
--      concluída depois de 3+ dias parado, no máximo 1 a cada 7 dias.
--
-- As regras (fatores, mínimos, bônus) ficam em
-- packages/shared/src/constants/adaptive.ts — o banco só guarda o resultado.

-- ---------------------------------------------------------------------------
-- 1. Novos motivos de transação e tipos de notificação
-- ---------------------------------------------------------------------------

ALTER TYPE public.point_reason ADD VALUE IF NOT EXISTS 'weekly_goal_reward';
ALTER TYPE public.point_reason ADD VALUE IF NOT EXISTS 'comeback_bonus';

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'weekly_goal';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'comeback';

-- ---------------------------------------------------------------------------
-- 2. Metas semanais
-- ---------------------------------------------------------------------------

CREATE TABLE public.weekly_goals (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Segunda-feira da semana (UTC)
  week_start     DATE          NOT NULL CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  -- Tarefas concluídas a atingir na semana
  target         INTEGER       NOT NULL CHECK (target > 0),
  -- Média semanal usada no cálculo (0 quando a meta é a padrão)
  base_average   NUMERIC(6,2)  NOT NULL DEFAULT 0 CHECK (base_average >= 0),
  -- Fator aplicado sobre a média
  factor         NUMERIC(4,2)  NOT NULL CHECK (factor > 0),
  -- Regra que definiu o fator: new_user | default | challenge | recovery | capped
  reason         TEXT          NOT NULL
                 CHECK (reason IN ('new_user', 'default', 'challenge', 'recovery', 'capped')),
  -- Bônus creditado ao bater a meta
  reward_points  INTEGER       NOT NULL CHECK (reward_points >= 0),
  -- Quando a meta foi batida — preenchido uma única vez (idempotência do bônus)
  achieved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Uma meta por usuário por semana: dois primeiros acessos simultâneos não
  -- criam duas metas (a API usa upsert ignorando o conflito)
  CONSTRAINT weekly_goals_user_week_unique UNIQUE (user_id, week_start)
);

-- Histórico (mais recentes primeiro) e busca das metas anteriores no cálculo
CREATE INDEX idx_weekly_goals_user_week
  ON public.weekly_goals(user_id, week_start DESC);

-- Regra de 7 dias do bônus de retomada: última transação comeback_bonus do usuário
CREATE INDEX idx_point_transactions_user_reason_recent
  ON public.point_transactions(user_id, reason, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- Só a API (service_role) cria e atualiza metas — sem policy de escrita de
-- propósito: o cliente não pode baixar a própria meta nem marcar como batida.
-- ---------------------------------------------------------------------------

ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_goals_select_own"
  ON public.weekly_goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
