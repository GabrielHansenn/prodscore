import type { TaskProof } from '@prodscore/shared';
import { api, extractApiErrorMessage } from './api.js';

/**
 * Envia (ou substitui) a foto de comprovação de conclusão de uma tarefa.
 *
 * @param taskId    - UUID da tarefa
 * @param file      - Blob da imagem já comprimida (ver lib/imageCompression.ts)
 * @param fileName  - Nome do arquivo enviado ao servidor
 * @param onProgress - Callback opcional com o percentual de envio (0–100)
 */
export async function uploadTaskProof(
  taskId: string,
  file: Blob,
  fileName: string,
  onProgress?: (percent: number) => void,
): Promise<TaskProof> {
  const formData = new FormData();
  formData.append('proof', file, fileName);

  try {
    const { data } = await api.post<{ prova: TaskProof }>(`/tasks/${taskId}/proof`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    });
    return data.prova;
  } catch (err) {
    throw new Error(extractApiErrorMessage(err, 'Erro ao enviar a foto de comprovação.'));
  }
}

/**
 * Obtém uma signed URL temporária para exibir a comprovação de uma tarefa.
 * Nunca retorna uma URL permanente — expira em poucos minutos.
 */
export async function getTaskProofUrl(taskId: string): Promise<string> {
  try {
    const { data } = await api.get<{ url: string }>(`/tasks/${taskId}/proof`);
    return data.url;
  } catch (err) {
    throw new Error(extractApiErrorMessage(err, 'Erro ao carregar a foto de comprovação.'));
  }
}

/** Remove a comprovação de uma tarefa (arquivo no Storage + registro no banco) */
export async function deleteTaskProof(taskId: string): Promise<void> {
  try {
    await api.delete(`/tasks/${taskId}/proof`);
  } catch (err) {
    throw new Error(extractApiErrorMessage(err, 'Erro ao remover a comprovação.'));
  }
}
