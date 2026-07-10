-- Migration: 008_storage
-- Descrição: Cria o bucket de avatares e define políticas de acesso.

-- Bucket público: leitura aberta, escrita autenticada
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Usuários autenticados podem fazer upload no próprio diretório ({user_id}/avatar.ext)
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Usuários podem substituir o próprio avatar
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Usuários podem deletar o próprio avatar
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leitura pública (bucket público, mas política explícita garante cobertura)
CREATE POLICY "avatars_public_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');
