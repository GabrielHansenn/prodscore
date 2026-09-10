import type { ChangeEvent, ReactNode, RefObject } from 'react';
import { CameraIcon } from './icons.js';
import { IMAGE_UPLOAD_HELP_TEXT } from '../lib/useImageUpload.js';

interface ImagePickerFieldProps {
  label:        string;
  /** Preview local do arquivo recém-selecionado (blob URL) — tem prioridade sobre `currentUrl` */
  previewUrl:   string | null;
  /** URL já persistida (avatar/capa atual), usada quando não há seleção nova */
  currentUrl:   string | null;
  /** Exibido quando não há nem preview nem URL atual (ex: iniciais do usuário ou um ícone de grupo) */
  fallback:     ReactNode;
  file:         File | null;
  inputRef:     RefObject<HTMLInputElement>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear:      () => void;
}

/**
 * Campo de upload de imagem com preview — mesmo visual/comportamento usado
 * pelo avatar de perfil (`ProfilePage.tsx`), reaproveitado pra capa de grupo.
 */
export default function ImagePickerField({
  label, previewUrl, currentUrl, fallback, file, inputRef, onFileChange, onClear,
}: ImagePickerFieldProps) {
  const imageSrc = previewUrl ?? currentUrl;

  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="relative h-16 w-16 shrink-0">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-brand-100 dark:bg-brand-900/30">
            {imageSrc ? (
              <img src={imageSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              fallback
            )}
          </div>
          {/* Overlay câmera */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 transition-opacity hover:opacity-100"
            aria-label={`Trocar ${label.toLowerCase()}`}
          >
            <CameraIcon className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Botões */}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            {file ? 'Trocar arquivo' : 'Escolher foto'}
          </button>
          {file && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancelar seleção
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onFileChange}
          className="sr-only"
        />
      </div>

      {file && (
        <p className="mt-2 text-xs text-gray-400">
          {file.name} &bull; {(file.size / 1024).toFixed(0)} KB
        </p>
      )}
      <p className="mt-1 text-xs text-gray-400">{IMAGE_UPLOAD_HELP_TEXT}</p>
    </div>
  );
}
