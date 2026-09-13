-- Migration: 023_streak_freeze_control
-- Descrição: Freeze de streak controlado pelo usuário + histórico auditável.
--
-- O que muda em relação à 010 (que só criou o contador profiles.streak_freezes):
--   1. freeze_armed_at   → o freeze deixa de ser automático. Só protege o
--      streak se o usuário tiver ARMADO antes do dia perdido terminar, o que
--      impede resgate retroativo de dias já perdidos.
--   2. freeze_streak_credited → maior múltiplo de 7 dias de streak que já
--      rendeu freeze. Vincula o ganho ao progresso REAL do streak (não à
--      passagem do tempo) e impede creditar o mesmo patamar duas vezes.
--      Zera junto com o streak.
--   3. streak_freeze_events → histórico de ganho/uso, que não existia.
--
-- Teto de saldo (3) é aplicado no backend (freeze.service.ts) para todas as
-- fontes: streak, recompensa de nível e compra por pontos.

-- ---------------------------------------------------------------------------
-- 1. Colunas de controle em profiles
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN freeze_armed_at TIMESTAMPTZ,
  ADD COLUMN freeze_streak_credited INTEGER NOT NULL DEFAULT 0
    CHECK (freeze_streak_credited >= 0);

COMMENT ON COLUMN public.profiles.freeze_armed_at IS
  'Momento em que o usuário armou um freeze. O freeze só é consumido se este '
  'valor for anterior ao fim do dia perdido — sem isso, o streak zera '
  'normalmente. Volta a NULL ao ser consumido ou desarmado.';

COMMENT ON COLUMN public.profiles.freeze_streak_credited IS
  'Maior múltiplo de FREEZE_STREAK_INTERVAL (7) dias de streak que já rendeu '
  'freeze. Impede ganhar o mesmo patamar duas vezes; zera quando o streak zera.';

-- ---------------------------------------------------------------------------
-- 2. Histórico de ganho/uso
-- ---------------------------------------------------------------------------

CREATE TYPE public.freeze_event_type AS ENUM (
  'earned_streak',   -- a cada 7 dias consecutivos de streak
  'earned_level',    -- recompensa de nível marco
  'purchased',       -- comprado com pontos
  'armed',           -- usuário armou (ainda não consumiu)
  'disarmed',        -- usuário desarmou antes de usar
  'consumed',        -- protegeu um dia perdido (1 evento por dia coberto)
  'capped'           -- ganho descartado por saldo já no teto
);

CREATE TABLE public.streak_freeze_events (
  id            UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID                     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          public.freeze_event_type NOT NULL,
  -- Saldo depois do evento (auditoria: permite reconstruir a linha do tempo)
  balance_after INTEGER                  NOT NULL CHECK (balance_after >= 0),
  -- Dia do streak que originou o ganho (só em earned_streak/capped)
  streak_day    INTEGER                  CHECK (streak_day IS NULL OR streak_day > 0),
  created_at    TIMESTAMPTZ              NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_streak_freeze_events_user_recent
  ON public.streak_freeze_events(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Só a API (service_role) escreve — não há policy de INSERT/UPDATE/DELETE, o
-- que impede o cliente de forjar ganho de freeze. O saldo em si continua em
-- profiles, que também só a API altera.
-- ---------------------------------------------------------------------------
ALTER TABLE public.streak_freeze_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streak_freeze_events_select_own"
  ON public.streak_freeze_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
