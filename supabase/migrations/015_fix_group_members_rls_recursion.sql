-- Migration: 015_fix_group_members_rls_recursion
-- Descrição: Corrige recursão infinita nas policies de RLS de group_members.
--
-- Bug (introduzido em 003_groups.sql): "group_members_select_same_group" e as
-- demais policies de escrita de group_members verificam a participação do
-- usuário no grupo consultando a PRÓPRIA tabela group_members dentro da sua
-- própria USING/WITH CHECK:
--
--   USING (
--     EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = ... )
--   )
--
-- Qualquer SELECT em group_members (mesmo o da subquery acima) precisa
-- reavaliar essa mesma policy, que faz outro SELECT em group_members, que
-- reavalia a policy de novo — recursão infinita. O Postgres aborta com
-- "infinite recursion detected in policy for relation \"group_members\"".
-- Isso também derruba, em cascata, qualquer policy em outra tabela (groups,
-- tasks) cuja regra faça uma subquery direta em group_members, pois essa
-- subquery aciona a policy de SELECT quebrada.
--
-- Correção: extrair a checagem de participação/admin para funções
-- SECURITY DEFINER. Dentro de uma função SECURITY DEFINER a consulta roda
-- como o dono da função (não como o papel "authenticated"), então a policy
-- "TO authenticated" não é reavaliada — a recursão para.

-- ---------------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id AND role IN ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- group_members — recriação das policies usando as funções acima
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "group_members_select_same_group" ON public.group_members;
CREATE POLICY "group_members_select_same_group"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_members.group_id, auth.uid()));

DROP POLICY IF EXISTS "group_members_insert_admin" ON public.group_members;
CREATE POLICY "group_members_insert_admin"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user_id AND role = 'member')
    OR public.is_group_admin(group_members.group_id, auth.uid())
  );

DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;
CREATE POLICY "group_members_delete"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_group_admin(group_members.group_id, auth.uid())
  );

DROP POLICY IF EXISTS "group_members_update_admin" ON public.group_members;
CREATE POLICY "group_members_update_admin"
  ON public.group_members FOR UPDATE
  TO authenticated
  USING     (public.is_group_admin(group_members.group_id, auth.uid()))
  WITH CHECK (public.is_group_admin(group_members.group_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- groups e tasks — policies que consultavam group_members diretamente
-- (não eram a origem da recursão, mas dependiam da policy quebrada acima
-- para resolver a subquery; migradas para a função por consistência)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "groups_update_admin" ON public.groups;
CREATE POLICY "groups_update_admin"
  ON public.groups FOR UPDATE
  TO authenticated
  USING     (public.is_group_admin(groups.id, auth.uid()))
  WITH CHECK (public.is_group_admin(groups.id, auth.uid()));

DROP POLICY IF EXISTS "tasks_select_group_member" ON public.tasks;
CREATE POLICY "tasks_select_group_member"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    group_id IS NOT NULL
    AND auth.uid() != user_id
    AND public.is_group_member(tasks.group_id, auth.uid())
  );
