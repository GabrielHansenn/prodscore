-- Migration: 024_task_description_rich
-- Descrição: Descrição de tarefa com texto rico (negrito, itálico, listas...).
--
-- O documento formatado (mesmo formato JSON do chat de grupo, ver
-- packages/shared/src/richText.ts) fica numa coluna nova. A coluna antiga
-- `description` continua existindo e passa a guardar uma cópia em texto puro,
-- gerada pela API a cada gravação — assim:
--   - nenhuma tarefa existente é alterada (description_rich fica NULL e o
--     texto antigo é exibido como está);
--   - versões antigas do app, que só leem `description`, continuam funcionando.
--
-- A validação do conteúdo (allowlist de nós e marcas, limite de 2000
-- caracteres no texto puro) é feita na API por normalizeRichText.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS description_rich JSONB;

COMMENT ON COLUMN public.tasks.description_rich IS
  'Descrição formatada (documento JSON de texto rico). NULL em tarefas antigas — nesse caso vale tasks.description.';
