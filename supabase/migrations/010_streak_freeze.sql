-- Migration: 010_streak_freeze
-- Descrição: Implementa dois sistemas da Fase 2:
--   1. Streak Freeze: permite proteger sequências ao perder exatamente 1 dia.
--      - Coluna streak_freezes em profiles (ganho em marcos + comprável com pontos).
--   2. Penalidade progressiva por atraso:
--      - Coluna overdue_since em tasks (quando a tarefa se tornou overdue).
--      - Trigger que auto-popula overdue_since na transição → 'overdue'.
--      - status 'abandoned' para tarefas abandonadas conscientemente.
--      - mark_overdue_tasks() atualizado para setar overdue_since.

-- ---------------------------------------------------------------------------
-- 1. streak_freezes em profiles
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN streak_freezes INTEGER NOT NULL DEFAULT 0 CHECK (streak_freezes >= 0);

COMMENT ON COLUMN public.profiles.streak_freezes IS
  'Número de freezes de streak disponíveis. '
  'Ganho: +1 a cada marco de streak atingido. '
  'Compra: 100 pts = 1 freeze via POST /users/me/streak/buy-freeze. '
  'Consumo automático quando o usuário perde exatamente 1 dia de streak.';

-- ---------------------------------------------------------------------------
-- 2. overdue_since em tasks
-- ---------------------------------------------------------------------------

ALTER TABLE public.tasks
  ADD COLUMN overdue_since TIMESTAMPTZ;

COMMENT ON COLUMN public.tasks.overdue_since IS
  'Momento em que a tarefa se tornou overdue pela primeira vez. '
  'Populado pelo trigger trg_tasks_overdue_since ou por mark_overdue_tasks(). '
  'Usado para calcular a penalidade progressiva por atraso na conclusão.';

-- ---------------------------------------------------------------------------
-- 3. Status 'abandoned' — tarefa encerrada conscientemente sem conclusão
-- ---------------------------------------------------------------------------

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'abandoned';

-- ---------------------------------------------------------------------------
-- 4. Trigger: auto-popula overdue_since na transição para 'overdue'
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_task_overdue_since()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Somente na primeira transição para 'overdue' (não sobrescreve se já existe)
  IF NEW.status = 'overdue'
     AND (OLD.status IS DISTINCT FROM 'overdue')
     AND NEW.overdue_since IS NULL
  THEN
    NEW.overdue_since := NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_overdue_since
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_task_overdue_since();

-- ---------------------------------------------------------------------------
-- 5. mark_overdue_tasks() atualizado: popula overdue_since nas transições
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_overdue_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.tasks
  SET
    status       = 'overdue',
    -- COALESCE preserva overdue_since existente (idempotente para tarefas já overdue)
    overdue_since = COALESCE(overdue_since, NOW()),
    updated_at   = NOW()
  WHERE
    status IN ('pending', 'in_progress')
    AND due_date IS NOT NULL
    AND due_date < NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
