import type { TaskProof } from '@prodscore/shared';
import { api } from './api';

interface ProofFile {
  uri:  string;
  name: string;
  type: string;
}

/**
 * Envia (ou substitui) a foto de comprovação de conclusão de uma tarefa.
 *
 * @param taskId     - UUID da tarefa
 * @param file       - Arquivo já selecionado/tirado (ver `expo-image-picker`)
 * @param onProgress - Callback opcional com o percentual de envio (0–100)
 */
export async function uploadTaskProof(
  taskId: string,
  file: ProofFile,
  onProgress?: (percent: number) => void,
): Promise<TaskProof> {
  const formData = new FormData();
  // React Native aceita { uri, name, type } em vez de um Blob real — o tipo
  // do FormData vem do lib.dom (Blob), que não reflete o polyfill nativo.
  formData.append('proof', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);

  const { data } = await api.post<{ prova: TaskProof }>(`/tasks/${taskId}/proof`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
  return data.prova;
}

/**
 * Obtém uma signed URL temporária para exibir a comprovação de uma tarefa.
 * Nunca retorna uma URL permanente — expira em poucos minutos.
 */
export async function getTaskProofUrl(taskId: string): Promise<string> {
  const { data } = await api.get<{ url: string }>(`/tasks/${taskId}/proof`);
  return data.url;
}

/** Remove a comprovação de uma tarefa (arquivo no Storage + registro no banco) */
export async function deleteTaskProof(taskId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}/proof`);
}
