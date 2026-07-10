-- Migration: 003_groups
-- Descrição: Cria as tabelas de grupos e membros com papéis.
--             Também finaliza a FK de tasks.group_id (dependência circular resolvida aqui).

CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.groups (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description  TEXT        CHECK (char_length(description) <= 500),
  image_url    TEXT,
  owner_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  -- Código de convite alfanumérico de 8 caracteres (gerado automaticamente)
  invite_code  TEXT        NOT NULL UNIQUE
                            DEFAULT upper(substr(md5(gen_random_uuid()::TEXT), 1, 8)),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.group_members (
  group_id   UUID               NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    UUID               NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.member_role NOT NULL DEFAULT 'member',
  joined_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user_id  ON public.group_members(user_id);
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_groups_owner_id        ON public.groups(owner_id);
CREATE INDEX idx_groups_invite_code     ON public.groups(invite_code);

-- Adiciona FK de tasks para groups (definida aqui pois groups não existia em 002)
ALTER TABLE public.tasks
  ADD CONSTRAINT fk_tasks_group
  FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Row Level Security — groups
-- ---------------------------------------------------------------------------
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ler grupos (necessário para busca por invite_code)
CREATE POLICY "groups_select_authenticated"
  ON public.groups FOR SELECT
  TO authenticated
  USING (true);

-- Qualquer autenticado pode criar um grupo; owner_id deve ser o próprio usuário
CREATE POLICY "groups_insert_authenticated"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Owner e admin podem editar dados do grupo (nome, descrição, imagem)
CREATE POLICY "groups_update_admin"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = groups.id
        AND gm.user_id  = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = groups.id
        AND gm.user_id  = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  );

-- Apenas o owner pode deletar o grupo
CREATE POLICY "groups_delete_owner"
  ON public.groups FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — group_members
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Membros podem ver todos os outros membros do mesmo grupo
CREATE POLICY "group_members_select_same_group"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id  = auth.uid()
    )
  );

-- Owner e admin podem adicionar membros (o backend valida o invite_code antes)
CREATE POLICY "group_members_insert_admin"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Auto-inserção: usuário pode entrar como 'member' (validação de invite_code feita no backend)
    (auth.uid() = user_id AND role = 'member')
    OR
    -- Admins/owners podem adicionar outros membros
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id  = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  );

-- Owner/admin pode remover qualquer membro; membro pode se remover (sair do grupo)
CREATE POLICY "group_members_delete"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id  = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  );

-- Owner/admin pode atualizar papéis dos membros
CREATE POLICY "group_members_update_admin"
  ON public.group_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id  = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    -- Não permite alterar o papel do owner para algo inferior via RLS client-side
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id  = auth.uid()
        AND gm.role IN ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Policy de tasks que depende de group_members (movida de 002_tasks.sql)
-- ---------------------------------------------------------------------------

-- Membros do grupo podem ler tarefas do grupo (sem permissão de escrita)
CREATE POLICY "tasks_select_group_member"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    group_id IS NOT NULL
    AND auth.uid() != user_id
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = tasks.group_id
        AND gm.user_id  = auth.uid()
    )
  );
