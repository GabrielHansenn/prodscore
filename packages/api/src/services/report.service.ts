import {
  REPORT_DEFAULT_DAYS,
  REPORT_MAX_RANGE_DAYS,
  defaultReportGranularity,
  reportRangeDays,
  utcWeekStart,
  type ReportGranularity,
  type StatsHistoryPoint,
  type StatsHistoryReport,
  type GroupStatsReport,
  type GroupMemberContribution,
} from '@prodscore/shared';
import { supabase } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';
import { requireMembership } from './group.service.js';

const DAY_MS = 86_400_000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------

export interface ReportRange {
  /** Primeiro dia, AAAA-MM-DD (UTC) */
  from:        string;
  /** Último dia, AAAA-MM-DD (UTC), inclusive */
  to:          string;
  granularity: ReportGranularity;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(key: string, days: number): string {
  return dayKey(new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS));
}

/** Data AAAA-MM-DD que existe de verdade (rejeita 2026-02-31) */
function isValidDateKey(value: string): boolean {
  return DATE_KEY.test(value) && dayKey(new Date(`${value}T00:00:00Z`)) === value;
}

/**
 * Valida e completa o período vindo da query string.
 * - sem from/to: últimos 30 dias até hoje (UTC)
 * - `to` no futuro é limitado a hoje
 * - from ≤ to e no máximo 366 dias
 * - granularity: day | week; se ausente, por dia até 31 dias e por semana acima
 */
export function parseReportRange(
  query: { from?: unknown; to?: unknown; granularity?: unknown },
  now: Date = new Date(),
): ReportRange {
  const today = dayKey(now);

  const to = query.to === undefined ? today : String(query.to);
  if (!isValidDateKey(to)) throw new AppError('Data final inválida. Use o formato AAAA-MM-DD.', 400, 'PERIODO_INVALIDO');
  const end = to > today ? today : to;

  const from = query.from === undefined ? addDays(end, -(REPORT_DEFAULT_DAYS - 1)) : String(query.from);
  if (!isValidDateKey(from)) throw new AppError('Data inicial inválida. Use o formato AAAA-MM-DD.', 400, 'PERIODO_INVALIDO');
  if (from > end) throw new AppError('A data inicial deve ser anterior ou igual à final.', 400, 'PERIODO_INVALIDO');

  const days = reportRangeDays(from, end);
  if (days > REPORT_MAX_RANGE_DAYS) {
    throw new AppError(`O período pode ter no máximo ${REPORT_MAX_RANGE_DAYS} dias.`, 400, 'PERIODO_INVALIDO');
  }

  let granularity: ReportGranularity;
  if (query.granularity === undefined) granularity = defaultReportGranularity(days);
  else if (query.granularity === 'day' || query.granularity === 'week') granularity = query.granularity;
  else throw new AppError('Granularidade inválida. Use "day" ou "week".', 400, 'PERIODO_INVALIDO');

  return { from, to: end, granularity };
}

/** Início (inclusive) e fim (exclusivo) do período em ISO */
function rangeBounds(range: ReportRange): { startISO: string; endISO: string } {
  return { startISO: `${range.from}T00:00:00.000Z`, endISO: `${addDays(range.to, 1)}T00:00:00.000Z` };
}

/** Percentual com 1 casa, ou null quando o denominador é 0 */
function rate(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : null;
}

/** Intervalos da série: cada dia, ou cada semana (segunda) cortada nas pontas do período */
export function buildBuckets(range: ReportRange): Array<{ date: string; firstDay: string; lastDay: string }> {
  const buckets: Array<{ date: string; firstDay: string; lastDay: string }> = [];
  if (range.granularity === 'day') {
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) buckets.push({ date: d, firstDay: d, lastDay: d });
    return buckets;
  }
  let weekStart = dayKey(utcWeekStart(new Date(`${range.from}T00:00:00Z`)));
  while (weekStart <= range.to) {
    const weekEnd = addDays(weekStart, 6);
    buckets.push({
      date:     weekStart,
      firstDay: weekStart < range.from ? range.from : weekStart,
      lastDay:  weekEnd > range.to ? range.to : weekEnd,
    });
    weekStart = addDays(weekStart, 7);
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Sequência (streak) reconstruída do histórico
// ---------------------------------------------------------------------------

/**
 * Reconstrói a sequência no fim de cada dia, com as mesmas regras do
 * updateStreak: um dia com tarefa concluída continua a sequência se o
 * anterior também teve; dias perdidos só não a zeram se foram cobertos por
 * freeze (eventos 'consumed', registrados no dia da volta, 1 por dia coberto).
 *
 * @param activeDays    dias (AAAA-MM-DD, UTC) com ao menos 1 tarefa concluída, de todo o histórico
 * @param consumedByDay freezes consumidos por dia
 * @param days          dias para os quais devolver o valor
 * @param today         hoje (UTC) — o dia de hoje ainda não "quebrou" a sequência
 */
export function reconstructStreaks(
  activeDays: string[],
  consumedByDay: Map<string, number>,
  days: string[],
  today: string,
): Map<string, number> {
  const sorted = [...new Set(activeDays)].sort();
  const streakOn = new Map<string, number>();
  /** Dia ativo → próximo dia ativo, quando os dias entre eles foram cobertos por freeze */
  const coveredUntil = new Map<string, string>();

  let previous: string | null = null;
  let streak = 0;
  for (const day of sorted) {
    if (previous === null) {
      streak = 1;
    } else {
      const missed = reportRangeDays(previous, day) - 2;
      if (missed === 0) {
        streak += 1;
      } else if ((consumedByDay.get(day) ?? 0) >= missed) {
        streak += 1;
        coveredUntil.set(previous, day);
      } else {
        streak = 1;
      }
    }
    streakOn.set(day, streak);
    previous = day;
  }

  const result = new Map<string, number>();
  let index = -1; // último dia ativo <= dia consultado
  for (const day of [...days].sort()) {
    while (index + 1 < sorted.length && sorted[index + 1]! <= day) index += 1;
    if (index < 0) { result.set(day, 0); continue; }

    const lastActive = sorted[index]!;
    const value = streakOn.get(lastActive) ?? 0;
    if (day === lastActive) result.set(day, value);
    else if (coveredUntil.has(lastActive)) result.set(day, value);                  // dia perdido, mas coberto por freeze
    else if (day === today && reportRangeDays(lastActive, day) === 2) result.set(day, value); // hoje ainda pode concluir
    else result.set(day, 0);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Relatório individual
// ---------------------------------------------------------------------------

export interface UserHistoryInput {
  range:            ReportRange;
  today:            string;
  /** Saldo atual de pontos (profiles.total_points) */
  totalPointsNow:   number;
  /** Transações desde o início do período até agora */
  transactions:     Array<{ amount: number; created_at: string }>;
  /** Todas as tarefas concluídas até o fim do período (para a sequência) */
  completions:      Array<{ completed_at: string; due_date: string | null }>;
  /** Eventos de freeze consumido até o fim do período */
  freezeConsumed:   Array<{ created_at: string }>;
  tasksCreated:     number;
  tasksCreatedDone: number;
  weeklyGoals:      Array<{ week_start: string; achieved_at: string | null }>;
}

/** Monta série e indicadores a partir dos dados já buscados (sem I/O) */
export function buildUserHistory(input: UserHistoryInput): StatsHistoryReport {
  const { range } = input;
  const { startISO, endISO } = rangeBounds(range);
  const start = Date.parse(startISO);
  const end   = Date.parse(endISO);
  const buckets = buildBuckets(range);

  // Datas em milissegundos: o PostgREST devolve "+00:00", não "Z" — comparar como texto erraria
  const completions = input.completions.map((c) => ({
    at:  Date.parse(c.completed_at),
    day: dayKey(new Date(c.completed_at)),
    due: c.due_date ? Date.parse(c.due_date) : null,
  }));
  const transactions = input.transactions.map((t) => ({ amount: t.amount, at: Date.parse(t.created_at) }));

  const inRange = completions.filter((c) => c.at >= start && c.at < end);

  // Sequência no último dia de cada intervalo
  const consumedByDay = new Map<string, number>();
  for (const e of input.freezeConsumed) {
    const day = dayKey(new Date(e.created_at));
    consumedByDay.set(day, (consumedByDay.get(day) ?? 0) + 1);
  }
  const streaks = reconstructStreaks(
    completions.map((c) => c.day),
    consumedByDay,
    buckets.map((b) => b.lastDay),
    input.today,
  );

  const series: StatsHistoryPoint[] = buckets.map((bucket) => {
    const bucketStart = Date.parse(`${bucket.firstDay}T00:00:00.000Z`);
    const bucketEnd   = Date.parse(`${addDays(bucket.lastDay, 1)}T00:00:00.000Z`);

    const tasksCompleted = inRange.filter((c) => c.at >= bucketStart && c.at < bucketEnd).length;
    const pointsEarned = transactions
      .filter((t) => t.amount > 0 && t.at >= bucketStart && t.at < bucketEnd)
      .reduce((sum, t) => sum + t.amount, 0);
    // Saldo no fim do intervalo = saldo atual − tudo o que entrou/saiu depois
    const after = transactions
      .filter((t) => t.at >= bucketEnd)
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      date:         bucket.date,
      tasksCompleted,
      pointsEarned,
      totalPoints:  Math.max(0, input.totalPointsNow - after),
      streak:       streaks.get(bucket.lastDay) ?? 0,
    };
  });

  const withDueDate = inRange.filter((c) => c.due !== null);
  // Mesma regra do completeTask: no prazo = concluída até o due_date
  const onTime      = withDueDate.filter((c) => c.at <= c.due!);
  const pointsEarned = transactions
    .filter((t) => t.amount > 0 && t.at >= start && t.at < end)
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    from:        range.from,
    to:          range.to,
    granularity: range.granularity,
    series,
    summary: {
      tasksCompleted:      inRange.length,
      pointsEarned,
      tasksCreated:        input.tasksCreated,
      completionRate:      rate(input.tasksCreatedDone, input.tasksCreated),
      tasksWithDueDate:    withDueDate.length,
      tasksOnTime:         onTime.length,
      punctualityRate:     rate(onTime.length, withDueDate.length),
      weeklyGoalsTotal:    input.weeklyGoals.length,
      weeklyGoalsAchieved: input.weeklyGoals.filter((g) => g.achieved_at !== null).length,
    },
  };
}

/** GET /users/me/stats/history — relatório individual do período */
export async function getUserStatsHistory(
  userId: string,
  totalPointsNow: number,
  range: ReportRange,
  now: Date = new Date(),
): Promise<StatsHistoryReport> {
  const { startISO, endISO } = rangeBounds(range);
  const firstWeek = dayKey(utcWeekStart(new Date(startISO)));

  const [txResult, completionsResult, freezeResult, createdResult, createdDoneResult, goalsResult] = await Promise.all([
    supabase.from('point_transactions').select('amount, created_at')
      .eq('user_id', userId).gte('created_at', startISO),
    supabase.from('tasks').select('completed_at, due_date')
      .eq('user_id', userId).eq('status', 'completed')
      .not('completed_at', 'is', null).lt('completed_at', endISO)
      .order('completed_at', { ascending: true }),
    supabase.from('streak_freeze_events').select('created_at')
      .eq('user_id', userId).eq('type', 'consumed').lt('created_at', endISO),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).gte('created_at', startISO).lt('created_at', endISO),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('user_id', userId).eq('status', 'completed').gte('created_at', startISO).lt('created_at', endISO),
    supabase.from('weekly_goals').select('week_start, achieved_at')
      .eq('user_id', userId).gte('week_start', firstWeek).lte('week_start', range.to),
  ]);

  const failed = [txResult, completionsResult, freezeResult, createdResult, createdDoneResult, goalsResult]
    .find((r) => r.error);
  if (failed) throw new AppError('Erro ao gerar o relatório.', 500, 'RELATORIO_FALHOU');

  return buildUserHistory({
    range,
    today:            dayKey(now),
    totalPointsNow,
    transactions:     (txResult.data ?? []) as UserHistoryInput['transactions'],
    completions:      (completionsResult.data ?? []) as UserHistoryInput['completions'],
    freezeConsumed:   (freezeResult.data ?? []) as UserHistoryInput['freezeConsumed'],
    tasksCreated:     createdResult.count ?? 0,
    tasksCreatedDone: createdDoneResult.count ?? 0,
    weeklyGoals:      (goalsResult.data ?? []) as UserHistoryInput['weeklyGoals'],
  });
}

// ---------------------------------------------------------------------------
// Métricas coletivas do grupo
// ---------------------------------------------------------------------------

export interface GroupStatsInput {
  range:             ReportRange;
  members:           Array<{ id: string; username: string; avatar_url: string | null }>;
  /** Tarefas do grupo concluídas no período */
  completedTasks:    Array<{ user_id: string; points_earned: number | null }>;
  tasksCreated:      number;
  tasksCreatedDone:  number;
  /** Conclusões de missões do grupo no período (uma linha por participante) */
  missionCompletions: Array<{ mission_id: string }>;
}

/** Monta os indicadores e a contribuição por membro (sem I/O) */
export function buildGroupStats(input: GroupStatsInput): GroupStatsReport {
  const byUser = new Map<string, { tasks: number; points: number }>();
  for (const task of input.completedTasks) {
    const entry = byUser.get(task.user_id) ?? { tasks: 0, points: 0 };
    entry.tasks  += 1;
    entry.points += task.points_earned ?? 0;
    byUser.set(task.user_id, entry);
  }

  const members: GroupMemberContribution[] = input.members
    .map((m) => ({
      userId:         m.id,
      username:       m.username,
      avatarUrl:      m.avatar_url,
      tasksCompleted: byUser.get(m.id)?.tasks  ?? 0,
      pointsEarned:   byUser.get(m.id)?.points ?? 0,
    }))
    .sort((a, b) => b.pointsEarned - a.pointsEarned || b.tasksCompleted - a.tasksCompleted
      || a.username.localeCompare(b.username, 'pt-BR'));

  return {
    from: input.range.from,
    to:   input.range.to,
    summary: {
      // Totais incluem tarefas de quem já saiu do grupo; o gráfico mostra só os membros atuais
      tasksCompleted:    input.completedTasks.length,
      pointsEarned:      input.completedTasks.reduce((sum, t) => sum + (t.points_earned ?? 0), 0),
      tasksCreated:      input.tasksCreated,
      completionRate:    rate(input.tasksCreatedDone, input.tasksCreated),
      activeMembers:     members.filter((m) => m.tasksCompleted > 0).length,
      totalMembers:      input.members.length,
      missionsCompleted: new Set(input.missionCompletions.map((c) => c.mission_id)).size,
    },
    members,
  };
}

/**
 * GET /groups/:id/stats — métricas coletivas do período. Só membros: a API
 * usa a service role (que ignora o RLS), então a checagem é explícita,
 * a mesma de ranking e missões do grupo (requireMembership → 403).
 */
export async function getGroupStats(groupId: string, userId: string, range: ReportRange): Promise<GroupStatsReport> {
  await requireMembership(groupId, userId);

  const { startISO, endISO } = rangeBounds(range);

  const [membersResult, completedResult, createdResult, createdDoneResult, missionsResult] = await Promise.all([
    supabase.from('group_members').select('user_id').eq('group_id', groupId),
    supabase.from('tasks').select('user_id, points_earned')
      .eq('group_id', groupId).eq('status', 'completed')
      .gte('completed_at', startISO).lt('completed_at', endISO),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('group_id', groupId).gte('created_at', startISO).lt('created_at', endISO),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('group_id', groupId).eq('status', 'completed').gte('created_at', startISO).lt('created_at', endISO),
    supabase.from('missions').select('id').eq('group_id', groupId),
  ]);

  const failed = [membersResult, completedResult, createdResult, createdDoneResult, missionsResult].find((r) => r.error);
  if (failed) throw new AppError('Erro ao gerar as métricas do grupo.', 500, 'RELATORIO_FALHOU');

  const memberIds  = ((membersResult.data ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
  const missionIds = ((missionsResult.data ?? []) as Array<{ id: string }>).map((m) => m.id);

  // Sem FK entre group_members e profiles (ver getGroupMembers): perfis numa segunda consulta
  const [profilesResult, missionCompletionsResult] = await Promise.all([
    memberIds.length > 0
      ? supabase.from('profiles').select('id, username, avatar_url').in('id', memberIds)
      : Promise.resolve({ data: [], error: null }),
    missionIds.length > 0
      ? supabase.from('mission_participants').select('mission_id')
          .in('mission_id', missionIds).eq('is_completed', true)
          .gte('completed_at', startISO).lt('completed_at', endISO)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error || missionCompletionsResult.error) {
    throw new AppError('Erro ao gerar as métricas do grupo.', 500, 'RELATORIO_FALHOU');
  }

  return buildGroupStats({
    range,
    members:            (profilesResult.data ?? []) as GroupStatsInput['members'],
    completedTasks:     (completedResult.data ?? []) as GroupStatsInput['completedTasks'],
    tasksCreated:       createdResult.count ?? 0,
    tasksCreatedDone:   createdDoneResult.count ?? 0,
    missionCompletions: (missionCompletionsResult.data ?? []) as GroupStatsInput['missionCompletions'],
  });
}
