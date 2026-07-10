import { TaskDifficulty, TaskPriority } from '../types/index.js';

/**
 * Pontuação base concedida ao concluir uma tarefa conforme sua dificuldade.
 * Valores maiores incentivam o usuário a aceitar tarefas mais desafiadoras.
 */
export const POINTS_BY_DIFFICULTY: Record<TaskDifficulty, number> = {
  [TaskDifficulty.Easy]: 10,
  [TaskDifficulty.Medium]: 25,
  [TaskDifficulty.Hard]: 50,
  [TaskDifficulty.Epic]: 100,
};

/**
 * Multiplicadores de pontuação por prioridade da tarefa.
 * Aplicados sobre a pontuação base × modificador de pontualidade.
 * Separa urgência de negócio (priority) de esforço técnico (difficulty).
 */
export const PRIORITY_MULTIPLIERS: Record<TaskPriority, number> = {
  [TaskPriority.Low]:    0.90,
  [TaskPriority.Medium]: 1.00,
  [TaskPriority.High]:   1.10,
  [TaskPriority.Urgent]: 1.25,
};

/**
 * Fração dos pontos base descontada quando uma tarefa é entregue com atraso.
 * Ex: tarefa Hard (50 pts) entregue com atraso perde 50 × 0.30 = 15 pts → recebe 35 pts.
 */
export const LATE_PENALTY_MULTIPLIER = 0.30;

/**
 * Fração dos pontos base adicionada como bônus quando a tarefa é entregue no prazo.
 * Ex: tarefa Medium (25 pts) no prazo ganha 25 × 0.20 = 5 pts bônus → recebe 30 pts.
 */
export const ON_TIME_BONUS_MULTIPLIER = 0.20;

/**
 * Marcos de streak (dias consecutivos) que concedem bônus de pontos ao usuário.
 * Ao atingir exatamente um desses valores, o usuário ganha STREAK_MILESTONE_BONUS pontos extras.
 */
export const STREAK_MILESTONES: ReadonlyArray<number> = [3, 7, 14, 30, 60, 90];

/**
 * Pontos extras concedidos quando o usuário atinge um marco de streak.
 * Recompensa consistência e disciplina ao longo do tempo.
 */
export const STREAK_MILESTONE_BONUS = 50;

/**
 * Freezes de streak concedidos ao atingir cada marco.
 * Permite ao usuário proteger sua sequência por 1 dia sem atividade.
 */
export const FREEZE_PER_MILESTONE = 1;

/**
 * Custo em pontos para comprar um freeze de streak via loja.
 * Alternativa aos freezes automáticos dos marcos.
 */
export const FREEZE_COST_POINTS = 100;

/**
 * Faixas de penalidade progressiva por atraso.
 * Quanto mais tempo a tarefa fica overdue, maior o desconto sobre os pontos.
 * Faixas: 0–12h → -10% | 12–24h → -20% | 24–48h → -35% | 48–72h → -50% | 72h+ → -60%
 */
export const LATE_PENALTY_TIERS: ReadonlyArray<{ maxHours: number; fraction: number }> = [
  { maxHours: 12,       fraction: 0.10 },
  { maxHours: 24,       fraction: 0.20 },
  { maxHours: 48,       fraction: 0.35 },
  { maxHours: 72,       fraction: 0.50 },
  { maxHours: Infinity, fraction: 0.60 },
];

/**
 * Aplica penalidade progressiva por atraso sobre os pontos já calculados.
 * Substitui a penalidade fixa de -30% para tarefas com due_date vencido.
 *
 * Garante mínimo de 1 ponto — completar sempre vale algo.
 *
 * @param points      - Pontos após cálculo de dificuldade × prioridade (sem modificador de prazo)
 * @param hoursOverdue - Horas desde que a tarefa se tornou overdue (≥ 0)
 */
export function applyLatePenalty(points: number, hoursOverdue: number): number {
  const tier = LATE_PENALTY_TIERS.find((t) => hoursOverdue <= t.maxHours)
    ?? LATE_PENALTY_TIERS[LATE_PENALTY_TIERS.length - 1]!;
  return Math.max(1, Math.floor(points * (1 - tier.fraction)));
}

/**
 * Calcula a quantidade de pontos totais necessários para atingir um nível.
 * A curva quadrática torna cada nível progressivamente mais desafiador.
 *
 * @param level - Nível alvo (deve ser >= 1)
 * @returns Quantidade de pontos acumulados necessários para entrar nesse nível
 */
export function levelThreshold(level: number): number {
  return level * level * 100;
}

/**
 * Recompensas nos níveis marco — espelha os dados da tabela level_rewards.
 * Usado pela UI para exibir preview de recompensas futuras sem chamar a API.
 */
export const LEVEL_REWARD_MILESTONES: ReadonlyArray<{
  level:        number;
  bonusPoints:  number;
  bonusFreezes: number;
  badgeKey:     string;
}> = [
  { level:   5, bonusPoints:   50, bonusFreezes:  1, badgeKey: 'rocket'  },
  { level:  10, bonusPoints:  100, bonusFreezes:  2, badgeKey: 'star'    },
  { level:  20, bonusPoints:  200, bonusFreezes:  3, badgeKey: 'diamond' },
  { level:  50, bonusPoints:  500, bonusFreezes:  5, badgeKey: 'crown'   },
  { level: 100, bonusPoints: 1000, bonusFreezes: 10, badgeKey: 'legend'  },
];
