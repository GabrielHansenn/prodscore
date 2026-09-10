import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ACCEPTED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES, MAX_IMAGE_SIZE_MB, type ImageMimeType } from '@prodscore/shared';

export interface PickedImage {
  uri:  string;
  name: string;
  type: ImageMimeType;
}

function extensionFor(mimeType: ImageMimeType): string {
  switch (mimeType) {
    case 'image/png':  return 'png';
    case 'image/webp': return 'webp';
    case 'image/gif':  return 'gif';
    default:           return 'jpg';
  }
}

/** Deriva o mimeType real do asset, com fallback pela extensão do nome do arquivo */
function resolveMimeType(mimeType: string | undefined, fileName: string | null | undefined): ImageMimeType | null {
  if (mimeType && ACCEPTED_IMAGE_MIME_TYPES.includes(mimeType as ImageMimeType)) {
    return mimeType as ImageMimeType;
  }
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (ext === 'png')  return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif')  return 'image/gif';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return null;
}

/**
 * Seleção de imagem (câmera ou galeria) com a mesma validação de tipo/tamanho
 * usada em toda imagem de exibição do app (avatar de perfil no web, capa de
 * grupo aqui) — JPG/PNG/WebP/GIF, máx. 2 MB.
 */
export function useImageUpload() {
  const [image, setImage] = useState<PickedImage | null>(null);
  const [error, setError] = useState('');

  const validateAndSet = (asset: ImagePicker.ImagePickerAsset) => {
    const resolvedType = resolveMimeType(asset.mimeType, asset.fileName);
    if (!resolvedType) {
      setError('Formato inválido. Use JPG, PNG, WebP ou GIF.');
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE_BYTES) {
      setError(`A imagem deve ter no máximo ${MAX_IMAGE_SIZE_MB} MB.`);
      return;
    }
    setError('');
    setImage({
      uri:  asset.uri,
      name: asset.fileName ?? `imagem.${extensionFor(resolvedType)}`,
      type: resolvedType,
    });
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      setError('Permissão de acesso à câmera negada. Habilite o acesso nas configurações do dispositivo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) validateAndSet(result.assets[0]);
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      setError('Permissão de acesso à galeria negada. Habilite o acesso nas configurações do dispositivo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) validateAndSet(result.assets[0]);
  };

  const clear = () => { setImage(null); setError(''); };

  return { image, error, takePhoto, pickFromLibrary, clear };
}
