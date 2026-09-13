-- Migration: 022_group_chat
-- Descrição: Chat entre os membros de um grupo — texto rico + imagem.
--
-- Conteúdo em JSONB (subconjunto do formato ProseMirror/Tiptap), não HTML:
-- o backend RECONSTRÓI o documento a partir de uma allowlist de tipos/marcas
-- (packages/shared/src/richText.ts), então não há markup para escapar e o
-- React Native consegue renderizar sem parser de HTML.
--
-- content_text guarda a versão em texto puro — usada na prévia da notificação
-- e para validar tamanho sem reprocessar o JSON.
--
-- "Mensagens novas": um marcador por membro (group_message_reads) em vez de
-- read_at por mensagem, que num grupo seria N mensagens × M membros.

CREATE TABLE public.group_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id    UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  content      JSONB,
  content_text TEXT        NOT NULL DEFAULT '' CHECK (char_length(content_text) <= 4000),
  -- Caminho no bucket privado "group-chat" ({group_id}/{uuid}.{ext}); a URL
  -- assinada é gerada na leitura, nunca armazenada
  image_path   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Mensagem vazia não existe: ou tem texto, ou tem imagem
  CONSTRAINT group_messages_not_empty CHECK (content_text <> '' OR image_path IS NOT NULL)
);

-- Histórico do grupo (mais recentes primeiro) e paginação por cursor
CREATE INDEX idx_group_messages_group_created
  ON public.group_messages(group_id, created_at DESC);

-- Marcador "li até aqui" por membro
CREATE TABLE public.group_message_reads (
  group_id     UUID        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (group_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- is_group_member() já existe (migration 015) e é SECURITY DEFINER — a policy
-- de SELECT é o que faz o Realtime entregar cada mensagem somente aos membros
-- daquele grupo.
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_messages_select_member"
  ON public.group_messages FOR SELECT
  TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "group_messages_insert_member"
  ON public.group_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_group_member(group_id, auth.uid())
  );

-- Sem UPDATE/DELETE: histórico imutável (mesma decisão de messages e point_transactions)

ALTER TABLE public.group_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_message_reads_all_own"
  ON public.group_message_reads FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND public.is_group_member(group_id, auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage — bucket privado das imagens do chat de grupo
--
-- Privado de propósito: o bucket "avatars" é público, e uma imagem enviada num
-- grupo privado não pode ficar acessível por URL para quem não é membro. Upload
-- e leitura passam pela API (service_role), que valida a participação e devolve
-- URL assinada de curta duração — mesmo padrão do bucket task-proofs.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-chat',
  'group-chat',
  false,
  2097152, -- 2 MB (mesmo limite das demais imagens de exibição)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;
