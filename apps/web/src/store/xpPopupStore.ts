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

interface XpPopupState {
  current: (XpGainPayload & { id: number }) | null;
  dismiss: () => void;
}

export const useXpPopupStore = create<XpPopupState>((set) => ({
  current: null,
  dismiss: () => set({ current: null }),
}));

/**
 * Mostra o popup animado de ganho de XP — barra de nível anima do valor
 * anterior pro novo, com destaque especial de "subiu de nível" quando for
 * o caso. Chame depois de qualquer ação que conceda pontos (concluir tarefa
 * pessoal ou de grupo — a missão eventualmente concluída junto entra em
 * `missionBonus`).
 */
export function showXpGain(payload: XpGainPayload): void {
  // Só um popup por vez — uma nova chamada substitui a anterior em vez de empilhar.
  useXpPopupStore.setState({ current: { ...payload, id: Date.now() } });
}
