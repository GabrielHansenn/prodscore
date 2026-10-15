-- Migration: 025_group_description_rich
-- Descrição: Descrição de grupo com texto rico — mesmo esquema da 024 (tarefas).
--
-- `description_rich` guarda o documento formatado; `description` continua
-- existindo como cópia em texto puro gerada pela API (e mantém o CHECK de
-- 500 caracteres). Grupos existentes não são alterados: ficam com
-- description_rich NULL e o texto antigo é exibido como está.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS description_rich JSONB;

COMMENT ON COLUMN public.groups.description_rich IS
  'Descrição formatada (documento JSON de texto rico). NULL em grupos antigos — nesse caso vale groups.description.';
