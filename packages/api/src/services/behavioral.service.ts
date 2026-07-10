import {
  TaskDifficulty,
  TaskPriority,
  BehavioralProfileType,
  type BehavioralProfile,
  type BehavioralTag,
  type ProcrastinationAlert,
  type TaskSuggestion,
} from '@prodscore/shared';
import { supabase } from '../lib/supabase.js';
import { mapTaskRow } from './task.service.js';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface CompletedTaskRow {
  completed_at: string;
  difficulty:   string;
}

interface PendingTaskRow {
  id:          string;
  user_id:     string;
  group_id:    string | null;
  title:       string;
  description: string | null;
  difficulty:  string;
  priority:    string;
  estimated_minutes: number | null;
  status:      string;
  due_date:    string | null;
  overdue_since: string | null;
  completed_at:  string | null;
  points_earned: number | null;
  created_at:    string;
  updated_at:    string;
}

interface StaleTaskRow {
  id:         string;
  title:      string;
  updated_at: string;
}

interface OverdueTaskRow {
  id:           string;
  title:        string;
  overdue_since: string | null;
}

interface UrgentTaskRow {
  id:    string;
  title: string;
}

// ---------------------------------------------------------------------------
// Auxiliares de perfil
// ---------------------------------------------------------------------------

/**
 * Determina o tipo de perfil comportamental com base na hora de pico.
 * Janelas de tempo baseadas nos padrões cronobiológicos clássicos.
 */
function profileTypeForHour(hour: number): Exclude<BehavioralProfileType, BehavioralProfileType.Undefined> {
  if (hour >= 5  && hour < 9)  return BehavioralProfileType.EarlyBird;
  if (hour >= 9  && hour < 12) return BehavioralProfileType.Morning;
  if (hour >= 12 && hour < 17) return BehavioralProfileType.Afternoon;
  if (hour >= 17 && hour < 22) return BehavioralProfileType.Evening;
  return BehavioralProfileType.NightOwl; // 22–24 e 0–5
}

// ---------------------------------------------------------------------------
// Mecânica 1 — Perfil comportamental
// ---------------------------------------------------------------------------

/**
 * Calcula o perfil comportamental do usuário a partir do histórico de tarefas.
 *
 * Análise realizada:
 * - Horário de pico: hora do dia com mais tarefas concluídas → define o tipo
 * - Tags: derivadas de streak, taxa de atraso e distribuição de dificuldade
 *
 * Mínimo de 5 tarefas concluídas necessário para calcular o tipo;
 * abaixo disso retorna 'indefinido' + tag 'iniciante'.
 *
 * @param userId - UUID do usuário
 */
export async function computeBehavioralProfile(userId: string): Promise<BehavioralProfile> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: completedData } = await supabase
    .from('tasks')
    .select('completed_at, difficulty')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', ninetyDaysAgo.toISOString())
    .not('completed_at', 'is', null);

  const completedTasks = (completedData ?? []) as CompletedTaskRow[];
  const totalAnalyzed  = completedTasks.length;

  if (totalAnalyzed < 5) {
    return {
      type:          BehavioralProfileType.Undefined,
      tags:          ['iniciante'],
      peakHour:      null,
      totalAnalyzed,
      computedAt:    new Date().toISOString(),
    };
  }

  // Distribui completions por hora UTC e encontra o pico
  const hourCounts = new Array<number>(24).fill(0) as number[];
  for (const task of completedTasks) {
    const hour = new Date(task.completed_at).getUTCHours();
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
  }
  const peakHour    = hourCounts.indexOf(Math.max(...hourCounts));
  const profileType = profileTypeForHour(peakHour);

  // Busca métricas de streak e overdue em paralelo
  const [profileResult, overdueResult, totalResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('current_streak')
      .eq('id', userId)
      .single(),
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'overdue'),
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  const currentStreak = (profileResult.data as { current_streak: number } | null)?.current_streak ?? 0;
  const overdueCount  = overdueResult.count  ?? 0;
  const totalTasks    = totalResult.count    ?? 0;
  const overdueRate   = totalTasks > 0 ? overdueCount / totalTasks : 0;

  // Distribui completions por dificuldade
  const hardEpicCount = completedTasks.filter(
    (t) => t.difficulty === TaskDifficulty.Hard || t.difficulty === TaskDifficulty.Epic,
  ).length;

  const tags: BehavioralTag[] = [];

  if (overdueRate > 0.25) {
    tags.push('procrastinador');
  } else if (currentStreak >= 7 && overdueRate < 0.15) {
    tags.push('consistente');
  }

  if (hardEpicCount / totalAnalyzed > 0.5) {
    tags.push('intenso');
  }

  if (totalAnalyzed >= 20) {
    const difficulties = new Set(completedTasks.map((t) => t.difficulty));
    if (difficulties.size >= 3) tags.push('metódico');
  }

  return {
    type:          profileType,
    tags,
    peakHour,
    totalAnalyzed,
    computedAt:    new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Mecânica 7 — Sugestões de tarefas
// ---------------------------------------------------------------------------

/**
 * Retorna até 5 sugestões de tarefas ordenadas por relevância.
 *
 * Score por tarefa:
 * - Prazo vencido: +60
 * - Prazo hoje: +50 | próximos 3 dias: +30 | próxima semana: +15
 * - Prioridade urgente: +40 | alta: +20 | baixa: −10
 * - Tempo parada: +5/dia (máx +30) + bônus +20 se > 5 dias
 *
 * @param userId - UUID do usuário
 */
export async function getTaskSuggestions(userId: string): Promise<TaskSuggestion[]> {
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: true });

  const now = new Date();

  const scored = (data ?? []).map((row) => {
    const task    = mapTaskRow(row as PendingTaskRow);
    let score     = 0;
    let reason    = '';

    // ── Prazo ─────────────────────────────────────────────────────────────
    if (task.dueDate) {
      const hoursUntil = (new Date(task.dueDate).getTime() - now.getTime()) / 3_600_000;
      if (hoursUntil < 0) {
        score += 60;
        reason = 'Tarefa atrasada — conclua logo para minimizar a penalidade';
      } else if (hoursUntil < 24) {
        score += 50;
        reason = 'Prazo hoje — não deixe para depois!';
      } else if (hoursUntil < 72) {
        score += 30;
        reason = `Prazo em ${Math.ceil(hoursUntil / 24)} dias`;
      } else if (hoursUntil < 168) {
        score += 15;
        reason = 'Prazo nesta semana';
      }
    }

    // ── Prioridade ────────────────────────────────────────────────────────
    if (task.priority === TaskPriority.Urgent) {
      score += 40;
      if (!reason) reason = 'Prioridade urgente — requer atenção imediata';
    } else if (task.priority === TaskPriority.High) {
      score += 20;
      if (!reason) reason = 'Alta prioridade';
    } else if (task.priority === TaskPriority.Low) {
      score -= 10;
    }

    // ── Tempo parada ──────────────────────────────────────────────────────
    const daysStale = (now.getTime() - new Date(task.createdAt).getTime()) / 86_400_000;
    const staleBonus = Math.min(30, Math.floor(daysStale) * 5);
    score += staleBonus;
    if (daysStale > 5) score += 20;

    if (!reason && daysStale > 3) {
      reason = `Parada há ${Math.floor(daysStale)} dias — hora de retomar!`;
    }

    if (!reason) reason = 'Recomendada com base no seu histórico';

    return { task, reason, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
}

// ---------------------------------------------------------------------------
// Mecânica 10 — Detecção de procrastinação
// ---------------------------------------------------------------------------

/**
 * Detecta padrões de procrastinação e retorna alertas classificados por severidade.
 *
 * Tipos de alerta:
 * - stale:   tarefas paradas há 3–5 dias (warning) ou > 5 dias (critical)
 * - overdue: tarefas com prazo vencido < 2 dias (warning) ou ≥ 2 dias (critical)
 * - cluster: 3–4 tarefas urgentes/alta prio pendentes (warning) ou ≥ 5 (critical)
 *
 * @param userId - UUID do usuário
 */
export async function getProcrastinationAlerts(userId: string): Promise<ProcrastinationAlert[]> {
  const alerts: ProcrastinationAlert[] = [];
  const now         = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3  * 86_400_000);
  const fiveDaysAgo  = new Date(now.getTime() - 5  * 86_400_000);
  const twoDaysAgo   = new Date(now.getTime() - 2  * 86_400_000);

  const [staleResult, overdueResult, urgentResult] = await Promise.all([
    // Tarefas pending/in_progress sem atualização há > 3 dias
    supabase
      .from('tasks')
      .select('id, title, updated_at')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .lt('updated_at', threeDaysAgo.toISOString()),

    // Tarefas com status overdue
    supabase
      .from('tasks')
      .select('id, title, overdue_since')
      .eq('user_id', userId)
      .eq('status', 'overdue'),

    // Tarefas urgentes ou de alta prioridade pendentes
    supabase
      .from('tasks')
      .select('id, title')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .in('priority', ['urgent', 'high']),
  ]);

  // ── Alertas de tarefas paradas ──────────────────────────────────────────
  const staleTasks = (staleResult.data ?? []) as StaleTaskRow[];
  if (staleTasks.length > 0) {
    const critical = staleTasks.filter((t) => new Date(t.updated_at) < fiveDaysAgo);
    const warning  = staleTasks.filter((t) => new Date(t.updated_at) >= fiveDaysAgo);

    if (critical.length > 0) {
      alerts.push({
        type:       'stale',
        severity:   'critical',
        message:    `${critical.length} tarefa(s) parada(s) há mais de 5 dias`,
        taskIds:    critical.map((t) => t.id),
        taskTitles: critical.map((t) => t.title),
      });
    }
    if (warning.length > 0) {
      alerts.push({
        type:       'stale',
        severity:   'warning',
        message:    `${warning.length} tarefa(s) sem atualização há 3–5 dias`,
        taskIds:    warning.map((t) => t.id),
        taskTitles: warning.map((t) => t.title),
      });
    }
  }

  // ── Alertas de tarefas atrasadas ────────────────────────────────────────
  const overdueTasks = (overdueResult.data ?? []) as OverdueTaskRow[];
  if (overdueTasks.length > 0) {
    const veryOverdue = overdueTasks.filter(
      (t) => t.overdue_since && new Date(t.overdue_since) < twoDaysAgo,
    );
    const recentOverdue = overdueTasks.filter(
      (t) => !t.overdue_since || new Date(t.overdue_since) >= twoDaysAgo,
    );

    if (veryOverdue.length > 0) {
      alerts.push({
        type:       'overdue',
        severity:   'critical',
        message:    `${veryOverdue.length} tarefa(s) atrasada(s) há mais de 2 dias`,
        taskIds:    veryOverdue.map((t) => t.id),
        taskTitles: veryOverdue.map((t) => t.title),
      });
    }
    if (recentOverdue.length > 0) {
      alerts.push({
        type:       'overdue',
        severity:   'warning',
        message:    `${recentOverdue.length} tarefa(s) com prazo vencido recentemente`,
        taskIds:    recentOverdue.map((t) => t.id),
        taskTitles: recentOverdue.map((t) => t.title),
      });
    }
  }

  // ── Alerta de cluster de urgência ───────────────────────────────────────
  const urgentTasks = (urgentResult.data ?? []) as UrgentTaskRow[];
  if (urgentTasks.length >= 3) {
    alerts.push({
      type:       'cluster',
      severity:   urgentTasks.length >= 5 ? 'critical' : 'warning',
      message:    `${urgentTasks.length} tarefas urgentes/prioritárias pendentes simultaneamente`,
      taskIds:    urgentTasks.map((t) => t.id),
      taskTitles: urgentTasks.map((t) => t.title),
    });
  }

  return alerts;
}
