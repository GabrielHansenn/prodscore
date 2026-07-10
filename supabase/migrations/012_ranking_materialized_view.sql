-- ============================================================
-- 012_ranking_materialized_view.sql
-- Mecânica 9: Ranking refinado com view materializada
--
-- Substitui as múltiplas queries + cálculo em TypeScript por:
--   • ranking_global_mv  — view materializada (score pré-computado)
--   • get_weekly_ranking — função SQL (depende da semana atual)
--   • refresh_ranking_global — função para atualizar a view
-- ============================================================

-- ----------------------------------------------------------
-- 1. View materializada para ranking global
--    Fórmula: score = total_points×0.5 + (streak×10)×0.3 + consistency_rate×0.2
-- ----------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS public.ranking_global_mv AS
WITH task_stats AS (
  SELECT
    user_id,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_tasks,
    COUNT(*)                                      AS total_tasks
  FROM public.tasks
  GROUP BY user_id
),
scored AS (
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    p.level,
    p.total_points,
    p.current_streak,
    COALESCE(ts.completed_tasks, 0)                              AS completed_tasks,
    COALESCE(ts.total_tasks, 0)                                  AS total_tasks,
    CASE
      WHEN COALESCE(ts.total_tasks, 0) > 0
      THEN (COALESCE(ts.completed_tasks, 0)::numeric / ts.total_tasks) * 100
      ELSE 0
    END AS consistency_rate,
    (
      p.total_points * 0.5 +
      p.current_streak * 10 * 0.3 +
      CASE
        WHEN COALESCE(ts.total_tasks, 0) > 0
        THEN (COALESCE(ts.completed_tasks, 0)::numeric / ts.total_tasks) * 100
        ELSE 0
      END * 0.2
    ) AS score
  FROM public.profiles p
  LEFT JOIN task_stats ts ON ts.user_id = p.id
)
SELECT
  ROW_NUMBER() OVER (ORDER BY score DESC, total_points DESC) AS position,
  id,
  username,
  avatar_url,
  level,
  total_points,
  current_streak,
  ROUND(consistency_rate, 1) AS consistency_rate,
  ROUND(score, 2)            AS score
FROM scored
ORDER BY score DESC, total_points DESC;

-- Índice único obrigatório para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS ranking_global_mv_id_idx       ON public.ranking_global_mv (id);
-- Índice auxiliar para consultas ordenadas por posição
CREATE INDEX        IF NOT EXISTS ranking_global_mv_position_idx ON public.ranking_global_mv (position);

-- ----------------------------------------------------------
-- 2. Função para atualizar a view materializada
--    Chamada via Edge Function agendada ou endpoint de admin.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_ranking_global()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- CONCURRENTLY permite leituras simultâneas durante o refresh
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.ranking_global_mv;
END;
$$;

-- ----------------------------------------------------------
-- 3. Função SQL para ranking semanal
--    DROP necessário porque CREATE OR REPLACE não pode alterar o RETURNS TABLE
DROP FUNCTION IF EXISTS public.get_weekly_ranking(integer);
--    Não pode ser materializada pois depende da semana corrente.
--    PostgreSQL: date_trunc('week', ...) retorna a segunda-feira ISO.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_weekly_ranking(p_limit integer DEFAULT 50)
RETURNS TABLE (
  "position"     bigint,
  user_id        uuid,
  username       text,
  avatar_url     text,
  level          integer,
  current_streak integer,
  weekly_points  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH week_start AS (
    SELECT date_trunc('week', now() AT TIME ZONE 'UTC') AS wstart
  ),
  weekly_totals AS (
    SELECT
      pt.user_id,
      SUM(pt.amount) AS weekly_points
    FROM public.point_transactions pt
    CROSS JOIN week_start
    WHERE pt.created_at >= week_start.wstart
      AND pt.amount > 0
    GROUP BY pt.user_id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY wt.weekly_points DESC) AS "position",
    p.id           AS user_id,
    p.username,
    p.avatar_url,
    p.level,
    p.current_streak,
    wt.weekly_points
  FROM weekly_totals wt
  JOIN public.profiles p ON p.id = wt.user_id
  ORDER BY wt.weekly_points DESC
  LIMIT p_limit;
$$;
