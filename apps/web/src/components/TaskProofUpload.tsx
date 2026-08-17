import { useRef, useState } from 'react';
import {
  ACCEPTED_PROOF_MIME_TYPES,
  MAX_PROOF_FILE_SIZE_BYTES,
  MAX_PROOF_FILE_SIZE_MB,
  type TaskProof,
} from '@prodscore/shared';
import { compressImage } from '../lib/imageCompression.js';
import { uploadTaskProof } from '../services/proof.service.js';

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  );
}

interface TaskProofUploadProps {
  /** UUID da tarefa que está sendo concluída */
  taskId: string;
  /** Chamado quando a foto é enviada e registrada com sucesso */
  onUploaded: (proof: TaskProof) => void;
  /** Chamado ao cancelar o fluxo sem enviar */
  onCancel: () => void;
}

/**
 * Modal de anexo de comprovação fotográfica ao concluir uma tarefa.
 *
 * Fluxo: selecionar/tirar foto → validar formato e tamanho → comprimir no
 * client → pré-visualizar → confirmar envio (com progresso).
 */
export default function TaskProofUpload({ taskId, onUploaded, onCancel }: TaskProofUploadProps) {
  const [preview,       setPreview]       = useState<string | null>(null);
  const [compressed,    setCompressed]    = useState<Blob | null>(null);
  const [processing,    setProcessing]    = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [progress,      setProgress]      = useState(0);
  const [error,         setError]         = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetSelection = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCompressed(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reselecionar o mesmo arquivo depois
    if (!file) return;

    if (!ACCEPTED_PROOF_MIME_TYPES.includes(file.type as (typeof ACCEPTED_PROOF_MIME_TYPES)[number])) {
      setError('Formato inválido. Envie uma imagem JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_PROOF_FILE_SIZE_BYTES) {
      setError(`A imagem deve ter no máximo ${MAX_PROOF_FILE_SIZE_MB} MB.`);
      return;
    }

    setError('');
    setProcessing(true);
    try {
      const compressedBlob = await compressImage(file);
      setCompressed(compressedBlob);
      setPreview(URL.createObjectURL(compressedBlob));
    } catch {
      setError('Não foi possível processar a imagem. Tente outra foto.');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!compressed) return;
    setUploading(true);
    setError('');
    setProgress(0);
    try {
      const proof = await uploadTaskProof(taskId, compressed, 'comprovacao.jpg', setProgress);
      onUploaded(proof);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar a foto de comprovação.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-proof-title"
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
      >
        <h2 id="task-proof-title" className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
          Comprovação de conclusão
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Esta tarefa exige uma foto como comprovação para ser concluída.
        </p>

        <label htmlFor="task-proof-input" className="sr-only">
          Selecionar ou tirar foto de comprovação
        </label>
        <input
          ref={fileInputRef}
          id="task-proof-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => void handleFileChange(e)}
          className="sr-only"
        />

        {!preview ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            className="btn-secondary flex w-full items-center justify-center gap-2 py-8"
          >
            <CameraIcon className="h-6 w-6" />
            {processing ? 'Processando...' : 'Tirar foto ou escolher arquivo'}
          </button>
        ) : (
          <div>
            <img
              src={preview}
              alt="Prévia da foto de comprovação"
              className="mb-3 max-h-64 w-full rounded-xl object-cover"
            />

            {uploading && (
              <div className="mb-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Enviando... {progress}%</p>
              </div>
            )}

            <button
              type="button"
              onClick={resetSelection}
              disabled={uploading}
              className="mb-3 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50 dark:text-brand-400"
            >
              Trocar foto
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel} disabled={uploading} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!compressed || uploading}
            className="btn-primary flex-1"
          >
            {uploading ? 'Enviando...' : 'Confirmar e concluir'}
          </button>
        </div>
      </div>
    </div>
  );
}
