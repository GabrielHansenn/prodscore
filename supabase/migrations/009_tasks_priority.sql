-- Migration: 009_tasks_priority
-- Descrição: Adiciona dois eixos complementares à tabela tasks:
--   - priority: urgência de negócio (independente de difficulty que mede esforço técnico)
--   - estimated_minutes: duração prevista em minutos (base para perfis comportamentais)
--
-- Eixos de pontuação da Mecânica 3:
--   difficulty     → pontuação BASE (easy=10, medium=25, hard=50, epic=100)
--   priority       → MULTIPLICADOR sobre a base (low=0.9×, medium=1.0×, high=1.1×, urgent=1.25×)
--   pontualidade   → AJUSTE final (+20% ou -30%)
--
-- Ambas as colunas são opcionais (sem breaking change nos clientes existentes).

CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

ALTER TABLE public.tasks
  ADD COLUMN priority          public.task_priority NOT NULL DEFAULT 'medium',
  ADD COLUMN estimated_minutes INTEGER              CHECK (estimated_minutes >= 1);

COMMENT ON COLUMN public.tasks.priority IS
  'Urgência de negócio da tarefa (separado de difficulty = esforço técnico). '
  'Multiplicador de pontuação: low=0.90×, medium=1.00×, high=1.10×, urgent=1.25×.';

COMMENT ON COLUMN public.tasks.estimated_minutes IS
  'Duração prevista para concluir a tarefa (minutos, mínimo 1). '
  'Usado para métricas comportamentais de produtividade (Fase 6).';

CREATE INDEX idx_tasks_priority ON public.tasks(priority);
