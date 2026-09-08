-- Corrige o cálculo de progresso de missões de grupo: por padrão, apenas
-- tarefas pertencentes ao próprio grupo (tasks.group_id = missions.group_id)
-- devem contar. O dono/admin do grupo pode optar por contar também tarefas
-- concluídas pelo membro fora do grupo (pessoais ou de outro grupo).

ALTER TABLE public.groups
  ADD COLUMN count_external_tasks_in_missions BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.groups.count_external_tasks_in_missions IS
  'Se TRUE, tarefas concluídas fora do grupo (pessoais ou de outro grupo) também contam para o progresso das missões coletivas deste grupo. Padrão: FALSE (só conta tarefas do próprio grupo).';
