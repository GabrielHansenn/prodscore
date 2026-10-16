-- Migration: 027_group_realtime_and_ranking_cron
-- Descrição: Área de grupos em tempo real + atualização periódica do ranking global.
--
--   1. Realtime: adiciona à publication supabase_realtime as tabelas que mudam
--      o ranking e as missões de um grupo. A tela de detalhe do grupo assina
--      postgres_changes filtrando pelo grupo e recarrega ranking e missões
--      pela API (o payload só serve de gatilho).
--   2. pg_cron: REFRESH do ranking_global_mv a cada 5 minutos, versionado aqui
--      em vez de depender do botão "Atualizar" ou de um cron configurado à mão
--      no painel do Supabase.
--
-- Segurança (RLS): o Realtime avalia as policies de SELECT de cada tabela com
-- o JWT do assinante antes de entregar um evento — quem não consegue ler a
-- linha pela API também não recebe o evento. Nenhuma policy é alterada aqui:
--
--   tasks                → tasks_all_owner (as próprias) + tasks_select_group_member
--                          (tarefas de grupos dos quais é membro, via group_members)
--   mission_participants → próprio progresso + progresso dos colegas em missões
--                          de grupo dos quais é membro (mission_participants_select)
--   missions             → individuais para todos; de grupo só para membros
--                          (missions_select_accessible)
--   profiles             → leitura já liberada a qualquer autenticado
--                          (profiles_select_authenticated) — é o perfil público
--                          que já aparece em ranking, amigos e grupos; nada novo
--                          fica exposto. Entra na publication porque total_points
--                          e current_streak (base do ranking do grupo) mudam
--                          também quando o membro conclui tarefa pessoal.
--
-- point_transactions NÃO entra de propósito: a policy é só "as próprias"
-- (point_transactions_select_own), então um membro nunca receberia as
-- transações dos colegas. O efeito delas no ranking chega pelo UPDATE de
-- profiles.total_points, sem expor o histórico de pontos de ninguém.
--
-- Observação: eventos DELETE não passam por filtro nem por RLS no Realtime,
-- por isso a tela assina só INSERT e UPDATE.

-- ---------------------------------------------------------------------------
-- 1. Realtime
-- ---------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.missions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- ---------------------------------------------------------------------------
-- 2. Atualização periódica do ranking global (pg_cron)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove o agendamento anterior (se a migration rodar de novo) antes de criar
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'refresh-ranking-global';

-- A cada 5 minutos. refresh_ranking_global() usa REFRESH ... CONCURRENTLY,
-- então o ranking continua legível durante a atualização.
SELECT cron.schedule(
  'refresh-ranking-global',
  '*/5 * * * *',
  $$SELECT public.refresh_ranking_global();$$
);
