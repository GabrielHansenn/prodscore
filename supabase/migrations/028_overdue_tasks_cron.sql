-- Migration: 028_overdue_tasks_cron
-- Descrição: Agendamento versionado (pg_cron) das rotinas periódicas que antes
--            dependiam de configurar um cron à mão no painel do Supabase.
--
--   process-overdue-tasks → toda hora cheia, marca como 'overdue' as tarefas
--                           pendentes/em andamento com prazo vencido
--   refresh-ranking       → já agendado na migration 027 (a cada 5 minutos,
--                           job 'refresh-ranking-global'); nada a fazer aqui
--
-- Por que chamar a função SQL e não a Edge Function: as duas Edge Functions
-- (supabase/functions/process-overdue-tasks e refresh-ranking) só fazem um
-- rpc() para mark_overdue_tasks() e refresh_ranking_global(). Agendar a função
-- direto no banco tem o mesmo efeito, sem chamada HTTP e sem precisar guardar
-- a service role key dentro do banco para autenticar a Edge Function. As Edge
-- Functions continuam disponíveis para execução manual.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove o agendamento anterior (se a migration rodar de novo) antes de criar
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'process-overdue-tasks';

-- Toda hora cheia, como sugeria o comentário da Edge Function ("0 * * * *").
-- mark_overdue_tasks() é idempotente: tarefas já 'overdue' não mudam e
-- overdue_since é preservado (ver migration 010).
SELECT cron.schedule(
  'process-overdue-tasks',
  '0 * * * *',
  $$SELECT public.mark_overdue_tasks();$$
);
