import { Alert } from 'react-native';
import { showToast } from '../store/toastStore';
import { getFriendlyErrorMessage } from './errors';

/**
 * Confirma e exclui uma tarefa — mesmo fluxo em todas as telas do app
 * (Início, Tarefas e tarefas do grupo): pergunta antes, avisa quando excluiu
 * e mostra o erro se a exclusão falhar.
 *
 * @param remove - chamada que exclui de fato (e atualiza a lista da tela)
 */
export function confirmTaskDeletion(remove: () => Promise<unknown>): void {
  Alert.alert('Excluir tarefa?', 'Esta ação não pode ser desfeita.', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Excluir',
      style: 'destructive',
      onPress: () => {
        remove()
          .then(() => showToast('Tarefa excluída.'))
          .catch((err: unknown) => {
            showToast(getFriendlyErrorMessage(err, 'Não foi possível excluir a tarefa.'), 'error');
          });
      },
    },
  ]);
}
