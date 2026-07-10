import { type Mission } from '@prodscore/shared';
import { api } from './api.js';

/** Missão com indicadores de participação do usuário */
export interface MissionWithParticipation extends Mission {
  isParticipating: boolean;
  joinedAt:        string | null;
}

/**
 * Retorna as missões disponíveis para o usuário com seu progresso atual.
 * Inclui missões individuais ativas e missões dos grupos do usuário.
 */
export async function getMissions(): Promise<MissionWithParticipation[]> {
  const { data } = await api.get<{ missoes: MissionWithParticipation[] }>('/missions');
  return data.missoes;
}

/**
 * Cria uma missão coletiva para um grupo (owner/admin apenas).
 */
export async function createGroupMission(
  groupId: string,
  input: {
    title:        string;
    description:  string;
    targetValue:  number;
    rewardPoints: number;
    expiresAt?:   string;
  },
): Promise<Mission> {
  const { data } = await api.post<{ missao: Mission }>(
    `/groups/${groupId}/missions`,
    input,
  );
  return data.missao;
}

/**
 * Registra a participação do usuário em uma missão individual.
 */
export async function joinMission(missionId: string): Promise<{ mission: Mission; joinedAt: string }> {
  const { data } = await api.post<{ missao: Mission; entradaEm: string }>(
    `/missions/${missionId}/join`,
  );
  return { mission: data.missao, joinedAt: data.entradaEm };
}
