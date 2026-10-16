/**
 * Gamificação adaptativa — regras que se ajustam ao histórico de cada usuário.
 *
 * Duas mecânicas:
 * 1. Meta semanal personalizada: alvo de tarefas concluídas na semana,
 *    calculado a partir da média do próprio usuário e do desempenho nas
 *    metas anteriores.
 * 2. Bônus de retomada: quem volta depois de alguns dias parado ganha um
 *    extra na primeira tarefa concluída.
 *
 * Ficam no shared para API, web e mobile usarem os mesmos valores (a UI
 * mostra o fator e a explicação da meta com base nestas constantes).
 */

import { WeeklyGoalReason, type WeeklyGoal } from '../types/index.js';

// ---------------------------------------------------------------------------
// Meta semanal
// ---------------------------------------------------------------------------

/** Quantas semanas completas anteriores entram na média (base da meta) */
export const WEEKLY_GOAL_HISTORY_WEEKS = 4;

/** Semanas completas de conta necessárias para a meta deixar de ser a padrão */
export const WEEKLY_GOAL_MIN_HISTORY_WEEKS = 2;

/** Meta de quem ainda não tem histórico suficiente */
export const WEEKLY_GOAL_DEFAULT_TARGET = 3;

/** Menor meta possível, mesmo com média baixa */
export const WEEKLY_GOAL_MIN_TARGET = 3;

/** Fator padrão: um pouco acima da média */
export const WEEKLY_GOAL_FACTOR_DEFAULT = 1.15;

/** Bateu as 2 últimas metas: mais desafio */
export const WEEKLY_GOAL_FACTOR_CHALLENGE = 1.25;

/** Não bateu a meta da semana anterior: meta = a própria média */
export const WEEKLY_GOAL_FACTOR_RECOVERY = 1.0;

/** Teto do fator para quem tem tag "procrastinador" ou "iniciante" */
export const WEEKLY_GOAL_FACTOR_CAP = 1.05;

/** Tags do perfil comportamental que limitam o fator a WEEKLY_GOAL_FACTOR_CAP */
export const WEEKLY_GOAL_CAPPED_TAGS: ReadonlyArray<string> = ['procrastinador', 'iniciante'];

/** Quantas metas batidas seguidas sobem o fator para o de desafio */
export const WEEKLY_GOAL_CHALLENGE_STREAK = 2;

/** Bônus por tarefa da meta ao batê-la (meta 12 → 120 pontos) */
export const WEEKLY_GOAL_POINTS_PER_TASK = 10;

// ---------------------------------------------------------------------------
// Bônus de retomada
// ---------------------------------------------------------------------------

/** Dias sem concluir tarefas para a próxima conclusão contar como retomada */
export const COMEBACK_INACTIVITY_DAYS = 3;

/** Fração extra sobre os pontos da tarefa (0,5 = +50%) */
export const COMEBACK_BONUS_MULTIPLIER = 0.5;

/** Intervalo mínimo entre dois bônus de retomada */
export const COMEBACK_COOLDOWN_DAYS = 7;

// ---------------------------------------------------------------------------
// Explicação da meta (mesmo texto no web e no mobile)
// ---------------------------------------------------------------------------

/** Percentual de ajuste do fator: 1,15 → "+15%" */
function factorLabel(factor: number): string {
  return `+${Math.round((factor - 1) * 100)}%`;
}

/** Média com no máximo 1 casa, no formato brasileiro (10,5) */
function formatAverage(value: number): string {
  return (Math.round(value * 10) / 10).toLocaleString('pt-BR');
}

/**
 * Frase que explica por que a meta da semana é essa — o usuário precisa ver
 * que o sistema se adaptou ao histórico dele.
 */
export function explainWeeklyGoal(goal: Pick<WeeklyGoal, 'reason' | 'baseAverage' | 'factor' | 'target'>): string {
  const text = explainReason(goal);
  // A conta deu menos que o piso: avisa que a meta foi arredondada para o mínimo
  const raisedToMin = goal.reason !== WeeklyGoalReason.NewUser
    && Math.ceil(goal.baseAverage * goal.factor) < WEEKLY_GOAL_MIN_TARGET;
  return raisedToMin ? `${text} A meta mínima é ${WEEKLY_GOAL_MIN_TARGET} tarefas.` : text;
}

function explainReason(goal: Pick<WeeklyGoal, 'reason' | 'baseAverage' | 'factor'>): string {
  const media = `sua média de ${formatAverage(goal.baseAverage)} tarefas por semana`;

  switch (goal.reason) {
    case WeeklyGoalReason.NewUser:
      return 'Meta inicial: ainda estamos conhecendo o seu ritmo.';
    case WeeklyGoalReason.Challenge:
      return `Você bateu as 2 últimas metas, então subimos o desafio: ${media} ${factorLabel(goal.factor)}.`;
    case WeeklyGoalReason.Recovery:
      return `A meta passada não foi batida, então esta semana a meta é ${media}, sem acréscimo.`;
    case WeeklyGoalReason.Capped:
      return `Calculada a partir da ${media}, com um acréscimo leve (${factorLabel(goal.factor)}) para você ganhar ritmo.`;
    case WeeklyGoalReason.Default:
    default:
      return `Calculada a partir da ${media}, ${factorLabel(goal.factor)} de desafio.`;
  }
}
