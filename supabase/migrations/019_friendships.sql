-- Migration: 019_friendships
-- Descrição: Sistema de amizades (pedido → aceitar/recusar → amizade).
--
-- Modelagem: UMA linha por par de usuários, em qualquer direção. A
-- bidirecionalidade (se A é amigo de B, B é amigo de A) vem da consulta
-- (`requester_id = eu OR addressee_id = eu`), não de duas linhas espelhadas —
-- evita o risco de as duas metades dessincronizarem. O índice único em
-- (LEAST, GREATEST) impede pedido duplicado nos dois sentidos.
--
-- Estados:
--   pending  → pedido enviado, aguardando o destinatário
--   accepted → amizade ativa
--   declined → recusado; a linha fica (histórico) e o requester pode reenviar
--              (volta para pending). Remover amizade / cancelar pedido = DELETE.

CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE public.friendships (
  id            UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID                     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id  UUID                     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        public.friendship_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ,

  CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id)
);

-- Um único vínculo por par, independente de quem pediu
CREATE UNIQUE INDEX idx_friendships_pair
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

-- "Pedidos recebidos" e "pedidos enviados"
CREATE INDEX idx_friendships_addressee_status ON public.friendships(addressee_id, status);
CREATE INDEX idx_friendships_requester_status ON public.friendships(requester_id, status);

-- ---------------------------------------------------------------------------
-- are_friends(a, b): amizade aceita em qualquer direção.
-- SECURITY DEFINER para poder ser usada dentro de policies de OUTRAS tabelas
-- (ex.: messages) sem depender da policy de friendships do chamador.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.are_friends(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = a AND f.addressee_id = b)
        OR (f.requester_id = b AND f.addressee_id = a))
  );
$$;

REVOKE ALL ON FUNCTION public.are_friends(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- A API (service_role) contorna RLS e reaplica estas mesmas regras em código
-- (friend.service.ts); as policies protegem o acesso direto do client.
-- ---------------------------------------------------------------------------
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Cada um vê só os vínculos dos quais participa
CREATE POLICY "friendships_select_participant"
  ON public.friendships FOR SELECT
  TO authenticated
  USING (auth.uid() IN (requester_id, addressee_id));

-- Só se cria pedido em nome próprio, e sempre como pending
CREATE POLICY "friendships_insert_own_request"
  ON public.friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id AND status = 'pending');

-- Só o destinatário responde (aceita/recusa)
CREATE POLICY "friendships_update_addressee"
  ON public.friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

-- Qualquer um dos dois desfaz (remover amizade / cancelar pedido)
CREATE POLICY "friendships_delete_participant"
  ON public.friendships FOR DELETE
  TO authenticated
  USING (auth.uid() IN (requester_id, addressee_id));
