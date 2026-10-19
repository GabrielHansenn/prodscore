/**
 * Limites de valores que o usuário digita — os mesmos na API (que é quem
 * garante a regra) e nos formulários do web e do mobile (que avisam antes).
 *
 * Por que existem: os campos aceitavam qualquer número e qualquer data.
 * - Tempo estimado com dezenas de dígitos estourava o banco (INTEGER) ou nem
 *   era aceito pelo navegador, e o formulário parecia travado.
 * - Missão de grupo aceitava até 100.000 pontos de recompensa — e a
 *   recompensa vai para TODOS os membros: dava para subir dezenas de níveis
 *   com uma missão de meta 1.
 * - Prazos e expirações não tinham limite de distância (ano 9999).
 */

import { WEEKLY_GOAL_POINTS_PER_TASK } from './adaptive.js';

/** Maior tempo estimado para uma tarefa: uma semana, em minutos */
export const TASK_ESTIMATE_MAX_MINUTES = 7 * 24 * 60;

/** Prazo de tarefa: no máximo a 1 ano de hoje */
export const TASK_DUE_DATE_MAX_DAYS = 365;

/** Expiração de missão de grupo: no máximo a 1 ano de hoje */
export const MISSION_EXPIRES_MAX_DAYS = 365;

/**
 * Recompensa de missão por tarefa da meta — a mesma taxa da meta semanal
 * (WEEKLY_GOAL_POINTS_PER_TASK), para as duas recompensas terem o mesmo peso.
 */
export const MISSION_REWARD_PER_TARGET = WEEKLY_GOAL_POINTS_PER_TASK;

/** Teto absoluto da recompensa de uma missão, qualquer que seja a meta */
export const MISSION_REWARD_MAX = 1000;

/** Maior recompensa permitida para uma missão com meta `targetValue` */
export function maxMissionReward(targetValue: number): number {
  if (!Number.isFinite(targetValue) || targetValue < 1) return 0;
  return Math.min(MISSION_REWARD_MAX, Math.floor(targetValue) * MISSION_REWARD_PER_TARGET);
}

/** Data/hora limite (agora + `days` dias) */
export function maxDateFromNow(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + days * 86_400_000);
}
