-- Migration: 002_tasks
-- Descrição: Cria os tipos enum e a tabela de tarefas.
--             Tarefas podem ser individuais ou vinculadas a um grupo.
--             A FK para groups é adicionada em 003_groups.sql (dependência de ordem).

CREATE TYPE public.task_difficulty AS ENUM ('easy', 'medium', 'hard', 'epic');
CREATE TYPE public.task_status     AS ENUM ('pending', 'in_progress', 'completed', 'overdue');

CREATE TABLE public.tasks (
  id            UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID                   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Nulo para tarefas individuais; FK para groups adicionada em 003
  group_id      UUID,
  title         TEXT                   NOT NULL CHECK (char_length(title) BETWEEN 1 AND 255),
  description   TEXT,
  difficulty    public.task_difficulty NOT NULL DEFAULT 'medium',
  status        public.task_status     NOT NULL DEFAULT 'pending',
  due_date      TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  -- Pontos efetivos após aplicação de bônus de pontualidade ou penalidade de atraso
  points_earned INTEGER                CHECK (points_earned >= 0),
  created_at    TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ            NOT NULL DEFAULT NOW(),

  -- Garante que completed_at só existe quando status é 'completed'
  CONSTRAINT chk_tasks_completed_at
    CHECK (
      (status = 'completed' AND completed_at IS NOT NULL)
      OR status != 'completed'
    ),
  -- Garante que points_earned só existe quando status é 'completed'
  CONSTRAINT chk_tasks_points_earned
    CHECK (
      (status = 'completed' AND points_earned IS NOT NULL)
      OR status != 'completed'
    )
);

-- Índices para os padrões de consulta mais frequentes
CREATE INDEX idx_tasks_user_id   ON public.tasks(user_id);
CREATE INDEX idx_tasks_group_id  ON public.tasks(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_tasks_status    ON public.tasks(status);
CREATE INDEX idx_tasks_due_date  ON public.tasks(due_date) WHERE due_date IS NOT NULL;
-- Índice parcial para tarefas pendentes com prazo (usada pelo job de detecção de overdue)
CREATE INDEX idx_tasks_overdue_check
  ON public.tasks(due_date)
  WHERE status IN ('pending', 'in_progress') AND due_date IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Dono da tarefa tem controle total (leitura e escrita)
CREATE POLICY "tasks_all_owner"
  ON public.tasks FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- NOTA: policy "tasks_select_group_member" está em 003_groups.sql
--       pois depende de public.group_members, criada naquele arquivo.

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
