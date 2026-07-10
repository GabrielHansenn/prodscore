-- Migration: 011_level_rewards
-- Descrição: Fase 3 — Progressão de Nível (mecânica 6)
--   Tabela level_rewards: recompensas automáticas ao atingir níveis marco.
--   Ao subir de nível, o sistema verifica se existe uma recompensa cadastrada
--   e concede pontos bônus + streak freezes automaticamente.

-- ---------------------------------------------------------------------------
-- 1. Tipo de transação para recompensas de nível
-- ---------------------------------------------------------------------------

ALTER TYPE public.point_reason ADD VALUE IF NOT EXISTS 'level_reward';

-- ---------------------------------------------------------------------------
-- 2. Tabela de recompensas por nível
-- ---------------------------------------------------------------------------

CREATE TABLE public.level_rewards (
  level         INTEGER PRIMARY KEY CHECK (level >= 2),
  bonus_points  INTEGER NOT NULL DEFAULT 0 CHECK (bonus_points  >= 0),
  bonus_freezes INTEGER NOT NULL DEFAULT 0 CHECK (bonus_freezes >= 0),
  badge_key     TEXT,
  description   TEXT NOT NULL
);

COMMENT ON TABLE public.level_rewards IS
  'Recompensas automáticas concedidas ao atingir níveis marco. '
  'Verificadas pelo serviço de gamificação ao chamar checkLevelUp().';

COMMENT ON COLUMN public.level_rewards.badge_key IS
  'Identificador de badge cosmético (exibido na UI). Null se o nível não tem badge.';

-- ---------------------------------------------------------------------------
-- 3. Seed — recompensas nos marcos de progressão
-- ---------------------------------------------------------------------------

INSERT INTO public.level_rewards (level, bonus_points, bonus_freezes, badge_key, description) VALUES
  (  5,   50,  1, 'rocket',   'Nível 5 desbloqueado! +50 pts e 1 Streak Freeze.'),
  ( 10,  100,  2, 'star',     'Nível 10 — Veterano! +100 pts e 2 Streak Freezes.'),
  ( 20,  200,  3, 'diamond',  'Nível 20 — Especialista! +200 pts e 3 Streak Freezes.'),
  ( 50,  500,  5, 'crown',    'Nível 50 — Mestre da Produtividade! +500 pts e 5 Freezes.'),
  (100, 1000, 10, 'legend',   'LENDA! Nível 100. +1000 pts e 10 Streak Freezes.');

-- ---------------------------------------------------------------------------
-- 4. RLS — leitura pública (qualquer usuário autenticado pode consultar)
-- ---------------------------------------------------------------------------

ALTER TABLE public.level_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de level_rewards"
  ON public.level_rewards FOR SELECT
  USING (auth.role() = 'authenticated');
