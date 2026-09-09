import { create } from 'zustand';

export interface XpMissionBonus {
  title:  string;
  points: number;
}

export interface XpGainPayload {
  points:              number;
  previousLevel:       number;
  newLevel:            number;
  previousTotalPoints: number;
  newTotalPoints:      number;
  leveledUp:           boolean;
  missionBonus?:       XpMissionBonus[];
}

export interface AchievementPayload {
  id:           string;
  name:         string;
  description:  string;
  /** Chave semântica do ícone — mesma usada no catálogo de conquistas */
  icon:         string;
  rewardPoints: number;
}

type QueueItem =
  | { id: number; kind: 'xp';          payload: XpGainPayload }
  | { id: number; kind: 'achievement'; payload: AchievementPayload };

interface GamificationPopupState {
  /** Item exibido agora (null = nada na tela) */
  current: QueueItem | null;
  /** Próximos itens, na ordem em que foram disparados */
  queue:   QueueItem[];
  /** Chamado pelo componente quando o item atual termina (tempo ou fechar manual) */
  advance: () => void;
}

/**
 * Fila única de notificações de gamificação — XP e conquista desbloqueada
 * entram na mesma fila e são mostradas uma de cada vez, na mesma posição da
 * tela, pra nunca sobrepor uma na outra.
 */
export const useGamificationPopupStore = create<GamificationPopupState>((set, get) => ({
  current: null,
  queue:   [],
  advance: () => {
    const [next, ...rest] = get().queue;
    set({ current: next ?? null, queue: rest });
  },
}));

function enqueue(item: Omit<QueueItem, 'id'>): void {
  const withId = { ...item, id: Date.now() + Math.random() } as QueueItem;
  const { current, queue } = useGamificationPopupStore.getState();
  if (current === null) {
    useGamificationPopupStore.setState({ current: withId });
  } else {
    useGamificationPopupStore.setState({ queue: [...queue, withId] });
  }
}

/**
 * Mostra o popup animado de ganho de XP — barra de nível anima do valor
 * anterior pro novo, com destaque especial de "subiu de nível" quando for
 * o caso. Chame depois de qualquer ação que conceda pontos (concluir tarefa
 * pessoal ou de grupo — a missão eventualmente concluída junto entra em
 * `missionBonus`).
 */
export function showXpGain(payload: XpGainPayload): void {
  enqueue({ kind: 'xp', payload });
}

/**
 * Mostra o popup de conquista desbloqueada. Chame uma vez por conquista nova
 * — se vier mais de uma na mesma ação, cada chamada entra na fila e elas
 * aparecem em sequência, nunca sobrepostas.
 */
export function showAchievementUnlocked(achievement: AchievementPayload): void {
  enqueue({ kind: 'achievement', payload: achievement });
}
