import { api } from './api.js';

/** Entrada normalizada de ranking (compatível com RankingTable) */
export interface RankingRow {
  position:      number;
  userId:        string;
  username:      string;
  avatarUrl:     string | null;
  level:         number;
  score:         number;
  currentStreak: number;
  /** Conta criada após o último refresh da view — ainda sem posição/score */
  pending?:      boolean;
}

/**
 * Busca o ranking global com pontuação multi-fator.
 * @param limite - Número máximo de entradas (padrão 50, máximo 100)
 */
export async function getGlobalRanking(limite = 50): Promise<RankingRow[]> {
  const { data } = await api.get<{ ranking: Array<{
    position:      number;
    usuario:       { id: string; username: string; avatarUrl: string | null; level: number };
    score:         number;
    currentStreak: number;
    totalPoints:   number;
  }> }>('/ranking/global', { params: { limite } });

  // Normaliza 'usuario' (PT) → campos planos para o componente
  return data.ranking.map((row) => ({
    position:      row.position,
    userId:        row.usuario.id,
    username:      row.usuario.username,
    avatarUrl:     row.usuario.avatarUrl,
    level:         row.usuario.level,
    score:         row.score,
    currentStreak: row.currentStreak,
  }));
}

/**
 * Solicita atualização da view materializada de ranking global.
 */
export async function refreshRanking(): Promise<void> {
  await api.post('/ranking/refresh');
}

/**
 * Ranking entre o usuário e seus amigos (mesmo score multi-fator do global).
 * Empates dividem a posição; quem ainda não entrou na view vem no fim com pending.
 */
export async function getFriendsRanking(): Promise<{ rows: RankingRow[]; totalAmigos: number }> {
  const { data } = await api.get<{
    ranking: Array<{
      position:      number | null;
      usuario:       { id: string; username: string; avatarUrl: string | null; level: number };
      score:         number | null;
      currentStreak: number;
    }>;
    totalAmigos: number;
  }>('/ranking/friends');

  return {
    totalAmigos: data.totalAmigos,
    rows: data.ranking.map((row) => ({
      position:      row.position ?? 0,
      userId:        row.usuario.id,
      username:      row.usuario.username,
      avatarUrl:     row.usuario.avatarUrl,
      level:         row.usuario.level,
      score:         row.score ?? 0,
      currentStreak: row.currentStreak,
      pending:       row.position === null,
    })),
  };
}

/**
 * Busca o ranking semanal baseado em pontos ganhos de segunda a domingo.
 * @param limite - Número máximo de entradas (padrão 50, máximo 100)
 */
export async function getWeeklyRanking(limite = 50): Promise<RankingRow[]> {
  const { data } = await api.get<{ ranking: Array<{
    position:       number;
    usuario:        { id: string; username: string; avatarUrl: string | null; level: number };
    pontosNaSemana: number;
    currentStreak:  number;
  }> }>('/ranking/weekly', { params: { limite } });

  // 'pontosNaSemana' vira 'score' para uniformidade com o componente
  return data.ranking.map((row) => ({
    position:      row.position,
    userId:        row.usuario.id,
    username:      row.usuario.username,
    avatarUrl:     row.usuario.avatarUrl,
    level:         row.usuario.level,
    score:         row.pontosNaSemana,
    currentStreak: row.currentStreak,
  }));
}
