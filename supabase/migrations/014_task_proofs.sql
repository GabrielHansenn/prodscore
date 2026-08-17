-- Migration: 014_task_proofs
-- Descrição: Comprovação fotográfica de conclusão de tarefa (accountability).
--
-- Decisão de modelagem — tabela dedicada (task_proofs) em vez de colunas em
-- tasks (proof_path/proof_uploaded_at):
--   1. RLS: a regra "membros do grupo podem visualizar a prova" precisa de uma
--      policy própria (join tasks → group_members). Expressar isso como RLS de
--      uma tabela é direto; como RLS de storage.objects (só enxerga o path do
--      arquivo) exigiria embutir a lógica de grupo na própria política de
--      Storage, mais frágil e difícil de auditar.
--   2. Coloca metadados de auditoria (content_type real detectado, tamanho,
--      quem enviou, quando) num lugar próprio, sem inflar a tabela tasks com
--      colunas que só fazem sentido quando requires_proof = true.
--   3. Mantém a porta aberta para múltiplas provas por tarefa no futuro sem
--      migração de schema (hoje restringido a 1:1 via UNIQUE, ver abaixo).

-- Tarefas que exigem prova fotográfica para serem concluídas
ALTER TABLE public.tasks
  ADD COLUMN requires_proof BOOLEAN NOT NULL DEFAULT false;

-- Registro da prova de conclusão de uma tarefa
CREATE TABLE public.task_proofs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Caminho dentro do bucket privado "task-proofs": {user_id}/{task_id}.{ext}
  storage_path TEXT        NOT NULL,
  -- Tipo de conteúdo REAL, detectado no servidor a partir dos bytes do
  -- arquivo (magic bytes) — nunca o Content-Type informado pelo cliente.
  content_type TEXT        NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  file_size    INTEGER     NOT NULL CHECK (file_size > 0 AND file_size <= 5242880), -- 5 MB
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Uma prova por tarefa — reenviar substitui o registro (ver serviço da API)
  CONSTRAINT task_proofs_task_id_unique UNIQUE (task_id)
);

CREATE INDEX idx_task_proofs_task_id ON public.task_proofs(task_id);
CREATE INDEX idx_task_proofs_user_id ON public.task_proofs(user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.task_proofs ENABLE ROW LEVEL SECURITY;

-- Dono da tarefa tem controle total sobre a própria prova
CREATE POLICY "task_proofs_all_owner"
  ON public.task_proofs FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Membros do grupo da tarefa podem visualizar a prova (verificação de ranking)
CREATE POLICY "task_proofs_select_group_member"
  ON public.task_proofs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.group_members gm ON gm.group_id = t.group_id
      WHERE t.id = task_proofs.task_id
        AND gm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Storage — bucket privado
-- ---------------------------------------------------------------------------
--
-- Diferente do bucket "avatars" (008_storage.sql), este NÃO tem políticas de
-- INSERT/SELECT para anon/authenticated de propósito: todo upload e toda
-- geração de signed URL passam pela API (packages/api), que valida o tipo
-- real do arquivo (magic bytes, não o MIME informado pelo cliente), o
-- tamanho e o ownership da tarefa antes de usar a service_role key — que
-- contorna RLS. Cliente nunca fala com o bucket diretamente.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-proofs',
  'task-proofs',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
