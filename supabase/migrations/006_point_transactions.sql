-- Migration: 006_point_transactions
-- Descrição: Ledger imutável de todas as movimentações de pontos.
--             Apenas o backend (service_role) insere registros.
--             Nenhum registro pode ser alterado ou deletado após criado.

CREATE TYPE public.point_reason AS ENUM (
  'task_completed',
  'streak_bonus',
  'late_penalty',
  'mission_reward',
  'achievement_bonus'
);

CREATE TABLE public.point_transactions (
  id            UUID                NOT NULL DEFAULT gen_random_uuid(),
  user_id       UUID                NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Positivo = ganho; negativo = perda (ex: penalidade por atraso)
  amount        INTEGER             NOT NULL CHECK (amount != 0),
  reason        public.point_reason NOT NULL,
  -- UUID da entidade de origem (ex: ID da tarefa, missão ou conquista)
  reference_id  UUID,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

  PRIMARY KEY (id),

  -- Validação de negócio: late_penalty deve ser sempre negativo
  CONSTRAINT chk_late_penalty_negative
    CHECK (reason != 'late_penalty' OR amount < 0)
);

-- Índice principal: histórico de um usuário ordenado do mais recente ao mais antigo
CREATE INDEX idx_point_transactions_user_recent
  ON public.point_transactions(user_id, created_at DESC);

-- Índice para ranking semanal (soma de transações nos últimos 7 dias)
CREATE INDEX idx_point_transactions_created_at
  ON public.point_transactions(created_at DESC);

-- Índice para busca de transações originadas por uma entidade específica
CREATE INDEX idx_point_transactions_reference_id
  ON public.point_transactions(reference_id) WHERE reference_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas as próprias transações
CREATE POLICY "point_transactions_select_own"
  ON public.point_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Apenas o backend registra transações (service_role bypassa; policy bloqueia cliente)
CREATE POLICY "point_transactions_insert_service_role"
  ON public.point_transactions FOR INSERT
  WITH CHECK (false);

-- Ledger é imutável: nenhum UPDATE ou DELETE permitido
CREATE POLICY "point_transactions_no_update"
  ON public.point_transactions FOR UPDATE
  USING (false);

CREATE POLICY "point_transactions_no_delete"
  ON public.point_transactions FOR DELETE
  USING (false);

-- ---------------------------------------------------------------------------
-- View auxiliar: pontos ganhos nos últimos 7 dias por usuário (ranking semanal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.weekly_points AS
  SELECT
    user_id,
    COALESCE(SUM(amount), 0) AS weekly_score
  FROM public.point_transactions
  WHERE created_at >= (NOW() - INTERVAL '7 days')
  GROUP BY user_id;

-- A view herda as políticas da tabela subjacente via security_invoker
ALTER VIEW public.weekly_points SET (security_invoker = true);
