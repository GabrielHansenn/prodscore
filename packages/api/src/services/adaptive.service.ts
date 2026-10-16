import {
  NotificationType,
  PointReason,
  WeeklyGoalReason,
  WEEKLY_GOAL_HISTORY_WEEKS,
  WEEKLY_GOAL_MIN_HISTORY_WEEKS,
  WEEKLY_GOAL_DEFAULT_TARGET,
  WEEKLY_GOAL_MIN_TARGET,
  WEEKLY_GOAL_FACTOR_DEFAULT,
  WEEKLY_GOAL_FACTOR_CHALLENGE,
  WEEKLY_GOAL_FACTOR_RECOVERY,
  WEEKLY_GOAL_FACTOR_CAP,
  WEEKLY_GOAL_CAPPED_TAGS,
  WEEKLY_GOAL_CHALLENGE_STREAK,
  WEEKLY_GOAL_POINTS_PER_TASK,
  COMEBACK_INACTIVITY_DAYS,
  COMEBACK_BONUS_MULTIPLIER,
  COMEBACK_COOLDOWN_DAYS,
  utcWeekStart,
  type WeeklyGoal,
  type WeeklyGoalProgress,
} from '@prodscore/shared';
import { supabase } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';
import { recordTransaction } from './gamification.service.js';
import { createNotification } from './notification.service.js';
import { computeBehavioralProfile } from './behavioral.service.js';

const DAY_MS  = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface WeeklyGoalRow {
  id:            string;
  user_id:       string;
  week_start:    string;
  target:        number;
  base_average:  number | string;
  factor:        number | string;
  reason:        string;
  reward_points: number;
  achieved_at:   string | null;
  created_at:    string;
}

/** Entrada do cálculo da meta — tudo já buscado do banco, para a função ser pura */
export interface WeeklyGoalInput {
  /** Semanas completas (segunda a domingo) desde a criação da conta */
  completeWeeks: number;
  /**
   * Tarefas concluídas por semana completa, da mais recente para a mais
   * antiga (no máximo WEEKLY_GOAL_HISTORY_WEEKS posições).
   */
  weeklyCounts: number[];
  /**
   * Metas das semanas anteriores, da mais recente para a mais antiga:
   * [semana passada, retrasada]. `null` = não houve meta registrada naquela
   * semana (neutra — nem batida, nem perdida).
   */
  previousGoals: Array<{ achieved: boolean } | null>;
  /** Tags do perfil comportamental (behavioral.service) */
  tags: string[];
}

export interface WeeklyGoalCalculation {
  target:       number;
  baseAverage:  number;
  factor:       number;
  reason:       WeeklyGoalReason;
  rewardPoints: number;
}

/** Resultado do bônus de meta semanal dentro do completeTask */
export interface WeeklyGoalRewardResult {
  target:       number;
  rewardPoints: number;
}

/** Resultado do bônus de retomada dentro do completeTask */
export interface ComebackBonusResult {
  bonusPoints:  number;
  daysInactive: number;
}

// ---------------------------------------------------------------------------
// Regras puras (testadas sem mock)
// ---------------------------------------------------------------------------

/**
 * Calcula a meta semanal a partir do histórico do usuário.
 *
 * - Menos de WEEKLY_GOAL_MIN_HISTORY_WEEKS (2) semanas completas de conta →
 *   meta padrão de 3 tarefas.
 * - base = média de tarefas concluídas nas últimas semanas completas (até 4;
 *   se a conta tem só 2 ou 3, a média usa só essas).
 * - fator, avaliado nesta ordem:
 *     1. não bateu a meta da semana passada  → 1,0  (meta alcançável)
 *     2. bateu as 2 últimas metas            → 1,25 (mais desafio)
 *     3. caso contrário                      → 1,15 (padrão)
 *   Tag "procrastinador" ou "iniciante" limita o fator a no máximo 1,05.
 * - meta = arredondar para cima (base × fator), mínimo 3.
 * - bônus = meta × 10 pontos.
 */
export function calculateWeeklyGoal(input: WeeklyGoalInput): WeeklyGoalCalculation {
  if (input.completeWeeks < WEEKLY_GOAL_MIN_HISTORY_WEEKS) {
    return {
      target:       WEEKLY_GOAL_DEFAULT_TARGET,
      baseAverage:  0,
      factor:       1,
      reason:       WeeklyGoalReason.NewUser,
      rewardPoints: WEEKLY_GOAL_DEFAULT_TARGET * WEEKLY_GOAL_POINTS_PER_TASK,
    };
  }

  const weeksUsed = Math.min(input.completeWeeks, WEEKLY_GOAL_HISTORY_WEEKS);
  const counts    = Array.from({ length: weeksUsed }, (_, i) => input.weeklyCounts[i] ?? 0);
  const baseAverage = Math.round((counts.reduce((sum, n) => sum + n, 0) / weeksUsed) * 100) / 100;

  const recent = input.previousGoals.slice(0, WEEKLY_GOAL_CHALLENGE_STREAK);
  const lastWeek = recent[0] ?? null;

  let factor: number;
  let reason: WeeklyGoalReason;
  if (lastWeek && !lastWeek.achieved) {
    factor = WEEKLY_GOAL_FACTOR_RECOVERY;
    reason = WeeklyGoalReason.Recovery;
  } else if (recent.length === WEEKLY_GOAL_CHALLENGE_STREAK && recent.every((g) => g?.achieved === true)) {
    factor = WEEKLY_GOAL_FACTOR_CHALLENGE;
    reason = WeeklyGoalReason.Challenge;
  } else {
    factor = WEEKLY_GOAL_FACTOR_DEFAULT;
    reason = WeeklyGoalReason.Default;
  }

  if (factor > WEEKLY_GOAL_FACTOR_CAP && input.tags.some((t) => WEEKLY_GOAL_CAPPED_TAGS.includes(t))) {
    factor = WEEKLY_GOAL_FACTOR_CAP;
    reason = WeeklyGoalReason.Capped;
  }

  // Arredonda o produto antes do ceil: 20 × 1,15 dá 22,999999… em ponto flutuante
  const raw    = Math.round(baseAverage * factor * 1000) / 1000;
  const target = Math.max(WEEKLY_GOAL_MIN_TARGET, Math.ceil(raw));

  return { target, baseAverage, factor, reason, rewardPoints: target * WEEKLY_GOAL_POINTS_PER_TASK };
}

/** Semanas completas (segunda a domingo) entre a criação da conta e o início da semana atual */
export function countCompleteWeeks(accountCreatedAt: Date, currentWeekStart: Date): number {
  const createdWeek = utcWeekStart(accountCreatedAt);
  // A semana em que a conta foi criada só conta se começou exatamente na segunda 00:00
  const firstFullWeek = createdWeek.getTime() === accountCreatedAt.getTime()
    ? createdWeek.getTime()
    : createdWeek.getTime() + WEEK_MS;
  return Math.max(0, Math.floor((currentWeekStart.getTime() - firstFullWeek) / WEEK_MS));
}

/**
 * A conclusão de agora conta como retomada?
 * - precisa ter uma conclusão anterior (a primeira tarefa da vida não é retomada);
 * - 3+ dias (72 h) desde essa conclusão;
 * - nenhum bônus de retomada nos últimos 7 dias.
 */
export function isComebackEligible(
  previousCompletedAt: Date | null,
  lastComebackAt: Date | null,
  now: Date,
): boolean {
  if (!previousCompletedAt) return false;
  if (now.getTime() - previousCompletedAt.getTime() < COMEBACK_INACTIVITY_DAYS * DAY_MS) return false;
  if (lastComebackAt && now.getTime() - lastComebackAt.getTime() < COMEBACK_COOLDOWN_DAYS * DAY_MS) return false;
  return true;
}

/** +50% dos pontos da tarefa (já com penalidade de atraso, se houver), mínimo 1 */
export function calculateComebackBonus(taskPoints: number): number {
  return Math.max(1, Math.floor(taskPoints * COMEBACK_BONUS_MULTIPLIER));
}

// ---------------------------------------------------------------------------
// Auxiliares de banco
// ---------------------------------------------------------------------------

function weekKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mapGoalRow(row: WeeklyGoalRow): WeeklyGoal {
  return {
    id:           row.id,
    weekStart:    row.week_start,
    target:       row.target,
    // NUMERIC chega como string pelo PostgREST
    baseAverage:  Number(row.base_average),
    factor:       Number(row.factor),
    reason:       row.reason as WeeklyGoalReason,
    rewardPoints: row.reward_points,
    achievedAt:   row.achieved_at,
  };
}

/** Tarefas concluídas pelo usuário em [from, to) */
async function fetchCompletionDates(userId: string, from: Date, to: Date): Promise<Date[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', from.toISOString())
    .lt('completed_at', to.toISOString());

  if (error) throw new AppError('Erro ao buscar histórico de tarefas.', 500);
  return (data ?? [])
    .map((r) => (r as { completed_at: string | null }).completed_at)
    .filter((d): d is string => d !== null)
    .map((d) => new Date(d));
}

/** Quantas tarefas o usuário concluiu na semana que começa em `weekStart` */
async function countCompletedInWeek(userId: string, weekStart: Date): Promise<number> {
  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', weekStart.toISOString())
    .lt('completed_at', new Date(weekStart.getTime() + WEEK_MS).toISOString());

  if (error) throw new AppError('Erro ao contar tarefas da semana.', 500);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Meta semanal
// ---------------------------------------------------------------------------

/**
 * Meta da semana atual do usuário. Cálculo preguiçoso: na primeira consulta
 * da semana a meta é calculada e gravada; depois disso fica fixa até a
 * próxima segunda (mudanças no histórico no meio da semana não mexem nela).
 */
export async function getOrCreateWeeklyGoal(userId: string, now: Date = new Date()): Promise<WeeklyGoal> {
  const weekStart = utcWeekStart(now);
  const key       = weekKey(weekStart);

  const { data: existing, error: existingError } = await supabase
    .from('weekly_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', key)
    .maybeSingle();

  if (existingError) throw new AppError('Erro ao buscar a meta da semana.', 500);
  if (existing) return mapGoalRow(existing as WeeklyGoalRow);

  const calc = await computeWeeklyGoalFor(userId, weekStart);

  // ignoreDuplicates: se outra requisição criou a meta no meio tempo, mantém a dela
  const { error: insertError } = await supabase
    .from('weekly_goals')
    .upsert(
      {
        user_id:       userId,
        week_start:    key,
        target:        calc.target,
        base_average:  calc.baseAverage,
        factor:        calc.factor,
        reason:        calc.reason,
        reward_points: calc.rewardPoints,
      },
      { onConflict: 'user_id,week_start', ignoreDuplicates: true },
    );

  if (insertError) throw new AppError('Erro ao criar a meta da semana.', 500);

  const { data: created, error: createdError } = await supabase
    .from('weekly_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', key)
    .single();

  if (createdError || !created) throw new AppError('Erro ao buscar a meta da semana.', 500);
  return mapGoalRow(created as WeeklyGoalRow);
}

/** Busca o histórico do usuário e aplica calculateWeeklyGoal */
async function computeWeeklyGoalFor(userId: string, weekStart: Date): Promise<WeeklyGoalCalculation> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .single();

  if (profileError || !profile) throw new AppError('Perfil não encontrado.', 404);

  const completeWeeks = countCompleteWeeks(new Date((profile as { created_at: string }).created_at), weekStart);
  if (completeWeeks < WEEKLY_GOAL_MIN_HISTORY_WEEKS) {
    return calculateWeeklyGoal({ completeWeeks, weeklyCounts: [], previousGoals: [], tags: [] });
  }

  const weeksUsed = Math.min(completeWeeks, WEEKLY_GOAL_HISTORY_WEEKS);
  const from      = new Date(weekStart.getTime() - weeksUsed * WEEK_MS);
  const prevKeys  = Array.from({ length: WEEKLY_GOAL_CHALLENGE_STREAK }, (_, i) =>
    weekKey(new Date(weekStart.getTime() - (i + 1) * WEEK_MS)));

  const [completions, previousResult, behavioral] = await Promise.all([
    fetchCompletionDates(userId, from, weekStart),
    supabase
      .from('weekly_goals')
      .select('week_start, achieved_at')
      .eq('user_id', userId)
      .in('week_start', prevKeys),
    computeBehavioralProfile(userId),
  ]);

  if (previousResult.error) throw new AppError('Erro ao buscar metas anteriores.', 500);

  // Índice 0 = semana passada, 1 = retrasada, …
  const weeklyCounts = new Array<number>(weeksUsed).fill(0);
  for (const date of completions) {
    const index = Math.floor((weekStart.getTime() - date.getTime() - 1) / WEEK_MS);
    if (index >= 0 && index < weeksUsed) weeklyCounts[index] = (weeklyCounts[index] ?? 0) + 1;
  }

  const previousRows = (previousResult.data ?? []) as Array<{ week_start: string; achieved_at: string | null }>;
  const previousGoals = prevKeys.map((k) => {
    const row = previousRows.find((r) => r.week_start === k);
    return row ? { achieved: row.achieved_at !== null } : null;
  });

  return calculateWeeklyGoal({ completeWeeks, weeklyCounts, previousGoals, tags: behavioral.tags });
}

/** Meta da semana atual com o progresso (GET /users/me/weekly-goal) */
export async function getWeeklyGoalProgress(userId: string, now: Date = new Date()): Promise<WeeklyGoalProgress> {
  const goal      = await getOrCreateWeeklyGoal(userId, now);
  const completed = await countCompletedInWeek(userId, utcWeekStart(now));
  return { ...goal, completed };
}

/**
 * Últimas metas (incluindo a da semana atual), com quantas tarefas foram
 * concluídas em cada semana. Uma meta passada com achievedAt = null não foi batida.
 */
export async function getWeeklyGoalHistory(userId: string, limit: number, now: Date = new Date()): Promise<WeeklyGoalProgress[]> {
  // Garante que a semana atual aparece mesmo se o usuário abriu Estatísticas antes do Início
  await getOrCreateWeeklyGoal(userId, now);

  const { data, error } = await supabase
    .from('weekly_goals')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(limit);

  if (error) throw new AppError('Erro ao buscar o histórico de metas.', 500);

  const goals = ((data ?? []) as WeeklyGoalRow[]).map(mapGoalRow);
  if (goals.length === 0) return [];

  const oldest  = new Date(`${goals[goals.length - 1]!.weekStart}T00:00:00.000Z`);
  const end     = new Date(utcWeekStart(now).getTime() + WEEK_MS);
  const dates   = await fetchCompletionDates(userId, oldest, end);

  return goals.map((goal) => {
    const start = new Date(`${goal.weekStart}T00:00:00.000Z`).getTime();
    const completed = dates.filter((d) => d.getTime() >= start && d.getTime() < start + WEEK_MS).length;
    return { ...goal, completed };
  });
}

/**
 * Credita o bônus da meta semanal se a tarefa recém-concluída fez o usuário
 * atingi-la. Idempotente: o UPDATE só preenche achieved_at se ainda for NULL
 * e só quem efetivamente atualizou a linha registra a transação — duas
 * conclusões simultâneas não pagam o bônus duas vezes.
 *
 * @returns o bônus concedido nesta chamada, ou null
 */
export async function checkWeeklyGoal(userId: string, now: Date = new Date()): Promise<WeeklyGoalRewardResult | null> {
  const goal = await getOrCreateWeeklyGoal(userId, now);
  if (goal.achievedAt) return null;

  const completed = await countCompletedInWeek(userId, utcWeekStart(now));
  if (completed < goal.target) return null;

  const { data: claimed, error } = await supabase
    .from('weekly_goals')
    .update({ achieved_at: now.toISOString() })
    .eq('id', goal.id)
    .is('achieved_at', null)
    .select('id');

  if (error) throw new AppError('Erro ao registrar a meta batida.', 500);
  if (!claimed || claimed.length === 0) return null;

  if (goal.rewardPoints > 0) {
    await recordTransaction(userId, goal.rewardPoints, PointReason.WeeklyGoalReward, goal.id);
  }

  await createNotification({
    userId,
    type:     NotificationType.WeeklyGoal,
    title:    'Meta da semana batida!',
    body:     `Você concluiu ${goal.target} tarefas esta semana: +${goal.rewardPoints} pts de bônus.`,
    entityId: goal.id,
  });

  return { target: goal.target, rewardPoints: goal.rewardPoints };
}

// ---------------------------------------------------------------------------
// Bônus de retomada
// ---------------------------------------------------------------------------

/**
 * Data da última tarefa concluída pelo usuário. Chamado pelo completeTask
 * ANTES de marcar a tarefa atual como concluída — senão a "última" seria ela.
 */
export async function getLastCompletionAt(userId: string): Promise<Date | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new AppError('Erro ao buscar a última tarefa concluída.', 500);
  const completedAt = (data as { completed_at: string } | null)?.completed_at;
  return completedAt ? new Date(completedAt) : null;
}

/**
 * Concede o bônus de retomada (+50% dos pontos da tarefa, transação separada)
 * se o usuário ficou 3+ dias sem concluir tarefas e não recebeu esse bônus
 * nos últimos 7 dias.
 *
 * @param previousCompletedAt - última conclusão ANTES desta tarefa (getLastCompletionAt)
 * @returns o bônus concedido, ou null
 */
export async function checkComebackBonus(
  userId: string,
  taskId: string,
  taskPoints: number,
  previousCompletedAt: Date | null,
  now: Date = new Date(),
): Promise<ComebackBonusResult | null> {
  // Atalho: sem inatividade suficiente nem precisa consultar o cooldown
  if (!isComebackEligible(previousCompletedAt, null, now)) return null;

  const { data, error } = await supabase
    .from('point_transactions')
    .select('created_at')
    .eq('user_id', userId)
    .eq('reason', PointReason.ComebackBonus)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new AppError('Erro ao verificar o bônus de retomada.', 500);
  const lastComebackRaw = (data as { created_at: string } | null)?.created_at;
  const lastComebackAt  = lastComebackRaw ? new Date(lastComebackRaw) : null;

  if (!isComebackEligible(previousCompletedAt, lastComebackAt, now)) return null;

  const bonusPoints  = calculateComebackBonus(taskPoints);
  const daysInactive = Math.floor((now.getTime() - previousCompletedAt!.getTime()) / DAY_MS);

  await recordTransaction(userId, bonusPoints, PointReason.ComebackBonus, taskId);

  await createNotification({
    userId,
    type:     NotificationType.Comeback,
    title:    'Bem-vindo de volta!',
    body:     `Você voltou depois de ${daysInactive} dias sem concluir tarefas: +${bonusPoints} pts de bônus de retomada.`,
    entityId: taskId,
  });

  return { bonusPoints, daysInactive };
}
