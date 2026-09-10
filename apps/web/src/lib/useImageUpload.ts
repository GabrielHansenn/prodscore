import { useRef, useState, type ChangeEvent } from 'react';
import { supabase } from './supabase.js';

/** Mesmos critérios usados pelo avatar de perfil — mantém consistência entre os dois. */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const IMAGE_UPLOAD_HELP_TEXT = 'JPG, PNG, WebP ou GIF • máx. 2 MB';

/**
 * Estado e validação de um seletor de imagem local (antes do upload de
 * verdade) — usado tanto pelo avatar de perfil quanto pela foto de capa do
 * grupo, mesmo critério de tipo/tamanho pros dois.
 */
export function useImageUpload() {
  const [file,        setFile]        = useState<File | null>(null);
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [error,       setError]       = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError('Formato inválido. Use JPG, PNG, WebP ou GIF.');
      return;
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setError('A imagem deve ter no máximo 2 MB.');
      return;
    }

    setError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    // Reset do input para permitir re-seleção do mesmo arquivo
    e.target.value = '';
  };

  const clear = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
  };

  return { file, previewUrl, error, setError, inputRef, handleFileChange, clear };
}

/**
 * Sobe uma imagem já validada pro bucket público "avatars" (mesmo bucket do
 * avatar de perfil — ver supabase/migrations/008_storage.sql) e devolve a URL
 * pública. O caminho fica sempre dentro da pasta do usuário autenticado
 * (`{userId}/{baseName}.{ext}`), porque é isso que a política de RLS do
 * bucket permite — funciona tanto pra avatar (`baseName: 'avatar'`) quanto
 * pra capa de grupo (`baseName: 'group-<id>'`).
 */
export async function uploadToAvatarsBucket(userId: string, file: File, baseName: string): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/${baseName}.${ext}`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw new Error('Erro ao fazer upload da imagem. Tente novamente.');

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
  return publicUrl;
}
