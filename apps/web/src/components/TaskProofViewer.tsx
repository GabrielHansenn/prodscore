import { useEffect, useState } from 'react';
import { getTaskProofUrl } from '../services/proof.service.js';

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M18 12.75h.008v.008H18v-.008zM3.75 21h16.5a1.5 1.5 0 001.5-1.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z" />
    </svg>
  );
}

interface TaskProofViewerProps {
  /** UUID da tarefa cuja comprovação será exibida */
  taskId: string;
}

/**
 * Miniatura da foto de comprovação de uma tarefa concluída, carregada via
 * signed URL temporária. Clique/toque abre em tamanho maior (lightbox).
 */
export default function TaskProofViewer({ taskId }: TaskProofViewerProps) {
  const [url,          setUrl]          = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    void getTaskProofUrl(taskId)
      .then((signedUrl) => { if (active) setUrl(signedUrl); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [taskId]);

  // Fecha o lightbox com Esc — acessibilidade por teclado
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen]);

  if (error) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        disabled={loading || !url}
        aria-label="Ver foto de comprovação em tamanho maior"
        className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 transition-opacity hover:opacity-80 disabled:cursor-default dark:border-gray-700 dark:bg-gray-800"
      >
        {url
          ? <img src={url} alt="" className="h-full w-full object-cover" />
          : <PhotoIcon className="h-full w-full p-2 text-gray-400" />
        }
      </button>

      {lightboxOpen && url && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto de comprovação em tamanho maior"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={url}
            alt="Comprovação de conclusão da tarefa, em tamanho maior"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Fechar imagem"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
