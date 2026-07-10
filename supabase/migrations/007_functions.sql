-- Migration: 007_functions
-- Descrição: Funções PostgreSQL auxiliares usadas pelo backend via supabase.rpc().
--             Todas são SECURITY DEFINER para contornar RLS nas operações administrativas.

-- ---------------------------------------------------------------------------
-- Incremento atômico de pontos totais
-- ---------------------------------------------------------------------------

/**
 * Incrementa (ou decrementa) o total de pontos de um usuário de forma atômica.
 * GREATEST garante que o saldo nunca fique negativo.
 *
 * Chamada no backend: supabase.rpc('increment_total_points', { p_user_id, p_amount })
 */
CREATE OR REPLACE FUNCTION public.increment_total_points(
  p_user_id UUID,
  p_amount  INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET total_points = GREATEST(0, total_points + p_amount)
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado para o usuário %', p_user_id;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Marcar tarefa como overdue (executada periodicamente via cron ou edge function)
-- ---------------------------------------------------------------------------

/**
 * Marca como 'overdue' todas as tarefas vencidas que ainda estão pendentes ou em andamento.
 * Deve ser chamada periodicamente (ex: a cada hora via pg_cron ou Supabase Edge Functions).
 *
 * Retorna o número de tarefas atualizadas.
 */
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
    status     = 'overdue',
    updated_at = NOW()
  WHERE
    status   IN ('pending', 'in_progress')
    AND due_date IS NOT NULL
    AND due_date < NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cálculo de ranking semanal por usuário (usado nas queries de ranking)
-- ---------------------------------------------------------------------------

/**
 * Retorna os N melhores usuários da semana com seus pontos e streaks.
 * @param p_limit - Número máximo de registros a retornar (padrão: 50)
 */
CREATE OR REPLACE FUNCTION public.get_weekly_ranking(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  rank_position  BIGINT,
  user_id        UUID,
  username       TEXT,
  avatar_url     TEXT,
  level          INTEGER,
  weekly_score   BIGINT,
  current_streak INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pt.amount), 0) DESC) AS rank_position,
    p.id           AS user_id,
    p.username,
    p.avatar_url,
    p.level,
    COALESCE(SUM(pt.amount), 0)                                   AS weekly_score,
    p.current_streak
  FROM public.profiles p
  LEFT JOIN public.point_transactions pt
    ON pt.user_id   = p.id
   AND pt.created_at >= NOW() - INTERVAL '7 days'
   AND pt.amount    > 0
  GROUP BY p.id
  ORDER BY weekly_score DESC
  LIMIT p_limit;
$$;
