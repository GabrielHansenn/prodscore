import { useCallback, useRef, useState } from 'react';

/**
 * Estado do "puxar para atualizar" (RefreshControl) de uma tela.
 *
 * `refreshing` só fica true durante o gesto do usuário — o carregamento
 * inicial da tela continua usando o indicador próprio dela. Erros da recarga
 * são ignorados aqui: cada tela já trata/exibe os erros das suas chamadas.
 *
 * @param reload - recarrega os dados da tela
 */
export function usePullToRefresh(reload: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  // Sempre a versão mais recente de reload, sem recriar onRefresh a cada render
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reloadRef.current()
      .catch(() => { /* a tela já mostra o erro da própria chamada */ })
      .finally(() => setRefreshing(false));
  }, []);

  return { refreshing, onRefresh };
}
