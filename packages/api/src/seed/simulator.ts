/**
 * Simulador do histórico de atividade do seed de demonstração.
 *
 * Gera ~90 dias de uso por pessoa e reproduz, conclusão a conclusão e em
 * ordem cronológica, o MESMO fluxo de gamificação do completeTask:
 *
 *   pontos da tarefa → sequência (updateStreak) → missões (checkMissionProgress)
 *   → bônus de retomada → meta semanal → conquistas → nível (checkLevelUp)
 *
 * Os cálculos usam as funções e constantes do sistema (calculateTaskPoints,
 * levelThreshold, STREAK_MILESTONES, FREEZE_*,
 * calculateWeeklyGoal, countCompleteWeeks, isComebackEligible,
 * calculateComebackBonus). As partes que no sistema gravam no banco com a
 * data de AGORA (updateStreak, checkLevelUp, checkAchievements, missões) são
 * reproduzidas aqui com as mesmas regras, mas com a data de cada evento —
 * por isso o saldo final é exatamente a soma das transações geradas e os
 * relatórios (que reconstroem o histórico a partir delas) batem.
 */

import {
  TaskDifficulty,
  TaskPriority,
  PointReason,
  NotificationType,
  FreezeEventType,
  STREAK_MILESTONES,
  STREAK_MILESTONE_BONUS,
  FREEZE_PER_MILESTONE,
  FREEZE_MAX_BALANCE,
  FREEZE_STREAK_INTERVAL,
  levelThreshold,
  utcWeekStart,
  normalizeRichText,
  richTextToPlainText,
  type RichTextDoc,
  calculateTaskPoints,
  type TaskDelivery,
} from '@prodscore/shared';
import {
  calculateWeeklyGoal,
  countCompleteWeeks,
  isComebackEligible,
  calculateComebackBonus,
} from '../services/adaptive.service.js';
import { Random } from './random.js';
import {
  PERSONA_TUNING,
  TASK_TITLES,
  TASK_DESCRIPTIONS,
  type PersonaTuning,
  type SeedGroup,
  type SeedPerson,
  type TaskTheme,
} from './catalog.js';

export const HOUR = 3_600_000;
export const DAY  = 24 * HOUR;
const WEEK = 7 * DAY;

export const dayKey  = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayStart = (ms: number) => Date.parse(`${dayKey(ms)}T00:00:00.000Z`);
const iso      = (ms: number) => new Date(ms).toISOString();
/** O cron de tarefas atrasadas roda de hora em hora: overdue_since = próxima hora cheia depois do prazo */
const nextFullHour = (ms: number) => Math.ceil(ms / HOUR) * HOUR;

// ---------------------------------------------------------------------------
// Tipos de entrada e saída
// ---------------------------------------------------------------------------

export interface AchievementDef {
  id:            string;
  name:          string;
  reward_points: number;
  criteria:      { type: string; threshold: number };
}

export interface LevelRewardDef {
  level:         number;
  bonus_points:  number;
  bonus_freezes: number;
}

export interface SimPerson extends SeedPerson { id: string }

export interface SimGroup extends Omit<SeedGroup, 'owner' | 'admins' | 'members'> {
  id:        string;
  createdAt: number;
  /** userId → { papel, entrada } — a conta preservada entra no fim (agora) */
  members:   Map<string, { role: 'owner' | 'admin' | 'member'; joinedAt: number }>;
}

export interface TaskRow {
  id: string; user_id: string; group_id: string | null; title: string;
  description: string | null; description_rich: RichTextDoc | null;
  difficulty: TaskDifficulty; priority: TaskPriority; estimated_minutes: number | null;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'abandoned';
  due_date: string | null; overdue_since: string | null; completed_at: string | null;
  points_earned: number | null; requires_proof: boolean; created_at: string; updated_at: string;
}

export interface SimOutput {
  profiles: Array<{
    id: string; created_at: string; level: number; total_points: number; current_streak: number;
    longest_streak: number; last_active_date: string | null; streak_freezes: number;
    freeze_armed_at: string | null; freeze_streak_credited: number;
  }>;
  tasks:          TaskRow[];
  proofs:         Array<{ taskId: string; userId: string; createdAt: string }>;
  transactions:   Array<{ id: string; user_id: string; amount: number; reason: PointReason; reference_id: string | null; created_at: string }>;
  freezeEvents:   Array<{ user_id: string; type: FreezeEventType; balance_after: number; streak_day: number | null; created_at: string }>;
  achievements:   Array<{ user_id: string; achievement_id: string; earned_at: string }>;
  weeklyGoals:    Array<{ id: string; user_id: string; week_start: string; target: number; base_average: number; factor: number; reason: string; reward_points: number; achieved_at: string | null; created_at: string }>;
  missions:       Array<{ id: string; group_id: string; title: string; description: string; target_value: number; reward_points: number; expires_at: string; created_at: string; kind: string }>;
  participants:   Array<{ mission_id: string; user_id: string; current_value: number; is_completed: boolean; completed_at: string | null; joined_at: string }>;
  notifications:  Array<{ id: string; user_id: string; type: NotificationType; title: string; body: string | null; actor_id: string | null; entity_id: string | null; created_at: string }>;
}

// ---------------------------------------------------------------------------
// Regras reproduzidas do sistema (exportadas para os testes compararem)
// ---------------------------------------------------------------------------

export interface StreakState {
  current_streak: number; longest_streak: number; last_active_date: string | null;
  streak_freezes: number; freeze_armed_at: string | null; freeze_streak_credited: number;
}

export interface StreakOutcome {
  milestoneReached: number | null;
  /** Eventos de freeze na ordem em que o updateStreak os grava */
  events: Array<{ type: FreezeEventType; balance_after: number; streak_day: number | null }>;
  /** Bônus de marco (transação streak_bonus), quando houver */
  bonus: number;
}

/**
 * Mesma regra de gamification.service → updateStreak (com creditStreakFreeze
 * e grantFreezes de freeze.service), aplicada no estado em memória para a
 * data `atMs` em vez de "agora".
 */
export function applyStreakUpdate(state: StreakState, atMs: number): StreakOutcome {
  const today = dayKey(atMs);
  const lastActive = state.last_active_date;
  if (lastActive === today) return { milestoneReached: null, events: [], bonus: 0 };

  const daysSinceActive = lastActive
    ? Math.round((Date.parse(today) - Date.parse(lastActive)) / DAY)
    : Infinity;
  const missedDays = Number.isFinite(daysSinceActive) ? daysSinceActive - 1 : 0;

  if (missedDays > 0 && state.freeze_armed_at && lastActive) {
    const firstMissedDayEnd = new Date(lastActive);
    firstMissedDayEnd.setUTCDate(firstMissedDayEnd.getUTCDate() + 2);
    firstMissedDayEnd.setUTCHours(0, 0, 0, 0);
    const armedInTime = new Date(state.freeze_armed_at) < firstMissedDayEnd;
    if (armedInTime && state.streak_freezes >= missedDays) {
      const before = state.streak_freezes;
      state.streak_freezes   = before - missedDays;
      state.last_active_date = today;
      state.freeze_armed_at  = null;
      return {
        milestoneReached: null,
        bonus: 0,
        events: Array.from({ length: missedDays }, (_, i) => ({
          type: FreezeEventType.Consumed, balance_after: before - (i + 1), streak_day: null,
        })),
      };
    }
  }

  const newStreak  = daysSinceActive === 1 ? state.current_streak + 1 : 1;
  const milestoneReached = (STREAK_MILESTONES as readonly number[]).includes(newStreak) ? newStreak : null;
  const creditedSoFar = newStreak === 1 ? 0 : state.freeze_streak_credited;
  const milestoneBalance = milestoneReached !== null
    ? Math.min(state.streak_freezes + FREEZE_PER_MILESTONE, FREEZE_MAX_BALANCE)
    : state.streak_freezes;
  const milestoneGranted = milestoneBalance - state.streak_freezes;

  state.current_streak         = newStreak;
  state.longest_streak         = Math.max(newStreak, state.longest_streak);
  state.last_active_date       = today;
  state.freeze_streak_credited = creditedSoFar;
  state.streak_freezes         = milestoneBalance;

  const events: StreakOutcome['events'] = [];
  if (milestoneReached !== null) {
    events.push({
      type: milestoneGranted > 0 ? FreezeEventType.EarnedStreak : FreezeEventType.Capped,
      balance_after: milestoneBalance, streak_day: milestoneReached,
    });
  }

  // creditStreakFreeze: 1 freeze a cada FREEZE_STREAK_INTERVAL dias consecutivos
  const milestone = Math.floor(newStreak / FREEZE_STREAK_INTERVAL) * FREEZE_STREAK_INTERVAL;
  if (milestone !== 0 && milestone > creditedSoFar) {
    const balance = Math.min(state.streak_freezes + 1, FREEZE_MAX_BALANCE);
    const granted = balance - state.streak_freezes;
    state.streak_freezes = balance;
    events.push({ type: granted > 0 ? FreezeEventType.EarnedStreak : FreezeEventType.Capped, balance_after: balance, streak_day: milestone });
    state.freeze_streak_credited = milestone;
  }

  return { milestoneReached, events, bonus: milestoneReached !== null ? STREAK_MILESTONE_BONUS : 0 };
}

/** Mesma conta do checkLevelUp: maior nível cujo limiar (nível² × 100) os pontos alcançam */
export function levelForPoints(totalPoints: number): number {
  let level = 1;
  while (totalPoints >= levelThreshold(level + 1)) level++;
  return level;
}

/** Mesma regra de behavioral.service → computeBehavioralProfile (só as tags, usadas pela meta semanal) */
export function behavioralTags(input: {
  completedLast90: Array<{ difficulty: TaskDifficulty }>;
  currentStreak: number; overdueCount: number; totalTasks: number;
}): string[] {
  const total = input.completedLast90.length;
  if (total < 5) return ['iniciante'];
  const overdueRate = input.totalTasks > 0 ? input.overdueCount / input.totalTasks : 0;
  const tags: string[] = [];
  if (overdueRate > 0.25) tags.push('procrastinador');
  else if (input.currentStreak >= 7 && overdueRate < 0.15) tags.push('consistente');
  const hardEpic = input.completedLast90.filter((t) => t.difficulty === TaskDifficulty.Hard || t.difficulty === TaskDifficulty.Epic).length;
  if (hardEpic / total > 0.5) tags.push('intenso');
  if (total >= 20 && new Set(input.completedLast90.map((t) => t.difficulty)).size >= 3) tags.push('metódico');
  return tags;
}

// ---------------------------------------------------------------------------
// Planejamento das tarefas
// ---------------------------------------------------------------------------

interface PlannedTask {
  row:          TaskRow;
  userId:       string;
  createdAt:    number;
  dueAt:        number | null;
  completedAt:  number | null;
  /** Data em que deixou de contar como "aberta" (abandono) */
  abandonedAt:  number | null;
}

const GROUP_THEME: Record<string, TaskTheme> = {
  squad: 'dev', tcc: 'estudos', freela: 'freela', turma: 'estudos', adm: 'gestao', banca: 'dev',
};
const DIFFICULTIES = [TaskDifficulty.Easy, TaskDifficulty.Medium, TaskDifficulty.Hard, TaskDifficulty.Epic] as const;

function richDescription(rng: Random, title: string): { text: string; doc: RichTextDoc } | null {
  const doc = normalizeRichText({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Checklist', marks: [{ type: 'bold' }] }, { type: 'text', text: ` — ${title.toLowerCase()}` }] },
      { type: 'bulletList', content: rng.shuffle(['Separar o material', 'Fazer a primeira versão', 'Revisar com calma', 'Enviar e avisar o grupo'])
        .slice(0, 3).map((item) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }] })) },
    ],
  });
  return doc ? { text: richTextToPlainText(doc), doc } : null;
}

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

export interface SimInput {
  now:          number;
  seed:         number;
  people:       SimPerson[];
  groups:       SimGroup[];
  achievements: AchievementDef[];
  levelRewards: LevelRewardDef[];
  /** Conta preservada: participa só dos grupos (entra agora), sem atividade simulada */
  preservedUserId: string;
}

interface UserState extends StreakState {
  person: SimPerson;
  joinedAt: number;
  tuning: PersonaTuning;
  points: number;
  level: number;
  earned: Set<string>;
  completed: PlannedTask[];
  groupMissionsCompleted: number;
  lastCompletionAt: number | null;
  lastComebackAt: number | null;
  goals: Map<string, SimOutput['weeklyGoals'][number]>;
}

export function simulate(input: SimInput): SimOutput {
  const rng = new Random(input.seed);
  const { now } = input;
  const out: SimOutput = {
    profiles: [], tasks: [], proofs: [], transactions: [], freezeEvents: [], achievements: [],
    weeklyGoals: [], missions: [], participants: [], notifications: [],
  };

  const users = new Map<string, UserState>();
  for (const person of input.people) {
    const tuning = { ...PERSONA_TUNING[person.persona], ...person.tune };
    users.set(person.id, {
      person, tuning,
      joinedAt: dayStart(now - person.joinedDaysAgo * DAY) + 10 * HOUR + rng.int(0, 8) * HOUR,
      points: 0, level: 1, earned: new Set(), completed: [], groupMissionsCompleted: 0,
      lastCompletionAt: null, lastComebackAt: null, goals: new Map(),
      current_streak: 0, longest_streak: 0, last_active_date: null,
      streak_freezes: 0, freeze_armed_at: null, freeze_streak_credited: 0,
    });
  }

  const groupsOf = (userId: string, at: number) =>
    input.groups.filter((g) => { const m = g.members.get(userId); return m !== undefined && m.joinedAt <= at; });

  // ── 1. Plano de tarefas por pessoa ─────────────────────────────────────────

  const planned: PlannedTask[] = [];
  /** Dias com atividade por pessoa (para decidir quando "armar" freeze antes de uma pausa) */
  const activeDays = new Map<string, string[]>();

  const newTask = (u: UserState, createdAt: number, groupId: string | null, theme: TaskTheme): PlannedTask => {
    const title = rng.pick(TASK_TITLES[theme]);
    let description: string | null = null;
    let descriptionRich: RichTextDoc | null = null;
    const roll = rng.next();
    if (roll < 0.15) {
      const rich = richDescription(rng, title);
      if (rich) { description = rich.text; descriptionRich = rich.doc; }
    } else if (roll < 0.5) {
      description = rng.pick(TASK_DESCRIPTIONS);
    }
    const isFreela = u.person.key === 'rafael_martins';
    const task: PlannedTask = {
      userId: u.person.id, createdAt, dueAt: null, completedAt: null, abandonedAt: null,
      row: {
        id: rng.uuid(), user_id: u.person.id, group_id: groupId, title, description,
        description_rich: descriptionRich,
        difficulty: rng.weighted(DIFFICULTIES.map((d, i) => [d, u.tuning.difficulty[i]!] as const)),
        priority: rng.weighted(isFreela
          ? [[TaskPriority.Low, 1], [TaskPriority.Medium, 3], [TaskPriority.High, 4], [TaskPriority.Urgent, 2]] as const
          : [[TaskPriority.Low, 2], [TaskPriority.Medium, 5], [TaskPriority.High, 2], [TaskPriority.Urgent, 1]] as const),
        estimated_minutes: rng.chance(0.5) ? rng.pick([15, 30, 45, 60, 90, 120]) : null,
        status: 'pending', due_date: null, overdue_since: null, completed_at: null, points_earned: null,
        requires_proof: false, created_at: iso(createdAt), updated_at: iso(createdAt),
      },
    };
    planned.push(task);
    return task;
  };

  const pickGroupFor = (u: UserState, at: number): SimGroup | null => {
    for (const g of rng.shuffle(groupsOf(u.person.id, at))) {
      if (rng.chance(g.taskShare)) return g;
    }
    return null;
  };

  for (const u of users.values()) {
    const t = u.tuning;
    const days: string[] = [];
    const stopAt = t.stopDaysAgo !== undefined ? now - t.stopDaysAgo * DAY : now;
    const forcedFrom = t.forcedStreak ? dayStart(now) - (t.forcedStreak - 1) * DAY : Infinity;

    for (let d = dayStart(u.joinedAt); d <= dayStart(now); d += DAY) {
      if (d > stopAt) break;
      const daysAgo = Math.round((dayStart(now) - d) / DAY);
      if ((t.gaps ?? []).some(([start, len]) => daysAgo <= start && daysAgo > start - len)) continue;
      const forced = d >= forcedFrom;
      if (!forced && !rng.chance(t.activeChance)) continue;

      const count = rng.int(t.perDay[0], t.perDay[1]);
      const times = Array.from({ length: count }, () => d + 11 * HOUR + rng.int(0, 12 * 60) * 60_000)
        .map((ms) => Math.max(ms, u.joinedAt + 30 * 60_000))
        .filter((ms) => ms < now - 10 * 60_000)
        .sort((a, b) => a - b);
      if (times.length === 0) continue;
      days.push(dayKey(d));

      for (const completedAt of times) {
        const group = pickGroupFor(u, completedAt);
        const theme = group ? GROUP_THEME[group.key] ?? 'trabalho' : rng.pick(u.person.themes);
        let createdAt = Math.max(u.joinedAt, completedAt - rng.int(1, 96) * HOUR);
        if (group) createdAt = Math.max(createdAt, group.members.get(u.person.id)!.joinedAt);
        const task = newTask(u, createdAt, group?.id ?? null, theme);
        task.completedAt = completedAt;
        if (rng.chance(t.dueChance)) {
          if (rng.chance(t.lateChance)) {
            task.dueAt = completedAt - rng.int(t.lateHours[0], t.lateHours[1]) * HOUR;
            if (task.dueAt <= task.createdAt) {
              task.createdAt = Math.max(u.joinedAt, task.dueAt - rng.int(6, 72) * HOUR);
              if (task.dueAt <= task.createdAt) task.dueAt = null;       // conta nova demais: sem prazo
            }
          } else {
            task.dueAt = completedAt + rng.int(2, 120) * HOUR;
          }
        }
        task.row.requires_proof = rng.chance(u.person.demo ? 0.12 : 0.06);
      }
    }
    activeDays.set(u.person.id, days);

    // Tarefas que terminam abertas: pendentes, em andamento, atrasadas e abandonadas
    const lastActive = Math.min(stopAt, now);
    const openTask = (status: TaskRow['status'], createdAt: number, dueAt: number | null) => {
      const group = pickGroupFor(u, createdAt);
      const task = newTask(u, Math.max(u.joinedAt, createdAt), group?.id ?? null, group ? GROUP_THEME[group.key] ?? 'trabalho' : rng.pick(u.person.themes));
      task.row.status = status;
      task.dueAt = dueAt !== null && dueAt > task.createdAt ? dueAt : null;
      // Conta nova demais para ter uma tarefa vencida: fica pendente (atrasada sem prazo não existe)
      if (status === 'overdue' && task.dueAt === null) task.row.status = 'pending';
      if (status === 'abandoned') task.abandonedAt = task.createdAt + rng.int(1, 5) * DAY;
      task.row.requires_proof = status !== 'abandoned' && rng.chance(0.1);
      return task;
    };
    const pending = rng.int(2, 5);
    for (let i = 0; i < pending; i++) {
      openTask('pending', lastActive - rng.int(1, 7 * 24) * HOUR, rng.chance(0.6) ? now + rng.int(6, 10 * 24) * HOUR : null);
    }
    for (let i = 0, n = rng.int(1, 2); i < n; i++) {
      openTask('in_progress', lastActive - rng.int(1, 5 * 24) * HOUR, rng.chance(0.5) ? now + rng.int(12, 6 * 24) * HOUR : null);
    }
    // As personas do TCC precisam ter tarefa em todos os status (inclusive atrasada)
    const overdueMin = u.person.demo ? Math.max(1, t.overdueLeft[0]) : t.overdueLeft[0];
    for (let i = 0, n = rng.int(overdueMin, Math.max(overdueMin, t.overdueLeft[1])); i < n; i++) {
      const due = now - rng.int(3, 20 * 24) * HOUR;
      openTask('overdue', due - rng.int(24, 6 * 24) * HOUR, due);
    }
    for (let i = 0, n = u.person.persona === 'procrastinador' ? 2 : rng.int(0, 1) + (u.person.demo ? 1 : 0); i < n; i++) {
      const created = Math.max(u.joinedAt, now - rng.int(15, 60) * DAY);
      openTask('abandoned', created, rng.chance(0.5) ? created + rng.int(2, 6) * DAY : null);
    }
  }

  // ── 2. Missões: metas definidas a partir das tarefas de grupo planejadas ──

  interface SimMission { row: SimOutput['missions'][number]; groupId: string; createdAt: number; expiresAt: number; target: number; reward: number }
  const missions: SimMission[] = [];
  const participants = new Map<string, Map<string, { current: number; completed: boolean; completedAt: number | null; joinedAt: number }>>();

  for (const g of input.groups) {
    for (const m of g.missions) {
      const createdAt = dayStart(now - m.startDaysAgo * DAY) + 12 * HOUR;
      const expiresAt = createdAt + m.durationDays * DAY;
      const doneInWindow = planned.filter((pt) =>
        pt.row.group_id === g.id && pt.completedAt !== null && pt.completedAt >= createdAt && pt.completedAt < Math.min(expiresAt, now),
      ).length;
      let target: number;
      if (m.kind === 'concluida') target = Math.max(2, Math.floor(doneInWindow * 0.75));
      else if (m.kind === 'expirada') target = doneInWindow + rng.int(8, 15);
      else target = doneInWindow + rng.int(6, 14);
      const row = {
        id: rng.uuid(), group_id: g.id, title: m.title, description: m.description,
        target_value: target, reward_points: m.reward, expires_at: iso(expiresAt), created_at: iso(createdAt), kind: m.kind,
      };
      missions.push({ row, groupId: g.id, createdAt, expiresAt, target, reward: m.reward });
      participants.set(row.id, new Map());
      out.missions.push(row);
    }
  }

  // ── 3. Processamento cronológico (o fluxo do completeTask) ────────────────

  let tick = 0;
  /** Evita empates de created_at dentro de uma mesma conclusão (preserva a ordem) */
  const at = (ms: number) => iso(ms + (tick++ % 900));

  const tx = (u: UserState, amount: number, reason: PointReason, referenceId: string | null, ms: number) => {
    out.transactions.push({ id: rng.uuid(), user_id: u.person.id, amount, reason, reference_id: referenceId, created_at: at(ms) });
    u.points = Math.max(0, u.points + amount); // GREATEST(0, total + amount), como increment_total_points
  };
  const notify = (u: UserState, type: NotificationType, title: string, body: string | null, entityId: string | null, ms: number) => {
    out.notifications.push({ id: rng.uuid(), user_id: u.person.id, type, title, body, actor_id: null, entity_id: entityId, created_at: at(ms) });
  };

  const checkAchievements = (u: UserState, ms: number) => {
    const owned = input.groups.filter((g) => g.members.get(u.person.id)?.role === 'owner');
    const ctx = {
      tasksCompleted: u.completed.length,
      epicCompleted: u.completed.filter((c) => c.row.difficulty === TaskDifficulty.Epic).length,
      currentStreak: u.current_streak,
      groupMembersCount: owned.reduce((s, g) => s + [...g.members.entries()].filter(([id, m]) => id !== u.person.id && m.joinedAt <= ms).length, 0),
      totalPoints: u.points,
      level: u.level,
      onTimeCompleted: u.completed.filter((c) => c.dueAt !== null && c.completedAt! <= c.dueAt).length,
      groupMissionsCompleted: u.groupMissionsCompleted,
    };
    const evaluators: Record<string, (t: number) => boolean> = {
      tasks_completed: (t) => ctx.tasksCompleted >= t,
      streak: (t) => ctx.currentStreak >= t,
      epic_task_completed: (t) => ctx.epicCompleted >= t,
      group_members: (t) => ctx.groupMembersCount >= t,
      points_earned: (t) => ctx.totalPoints >= t,
      level_reached: (t) => ctx.level >= t,
      on_time_completed: (t) => ctx.onTimeCompleted >= t,
      group_missions_completed: (t) => ctx.groupMissionsCompleted >= t,
    };
    for (const a of input.achievements) {
      if (u.earned.has(a.id)) continue;
      const evaluator = evaluators[a.criteria.type];
      if (!evaluator || !evaluator(a.criteria.threshold)) continue;
      u.earned.add(a.id);
      out.achievements.push({ user_id: u.person.id, achievement_id: a.id, earned_at: at(ms) });
      if (a.reward_points > 0) tx(u, a.reward_points, PointReason.AchievementBonus, a.id, ms);
      notify(u, NotificationType.Achievement, 'Conquista desbloqueada!',
        a.reward_points > 0 ? `${a.name} · +${a.reward_points} pts` : a.name, a.id, ms);
    }
  };

  const checkLevelUp = (u: UserState, ms: number) => {
    const calculated = levelForPoints(u.points);
    if (calculated <= u.level) return;
    u.level = calculated;
    const reward = input.levelRewards.find((r) => r.level === calculated);
    if (reward) {
      if (reward.bonus_points > 0) tx(u, reward.bonus_points, PointReason.LevelReward, null, ms);
      if (reward.bonus_freezes > 0) {
        const balance = Math.min(u.streak_freezes + reward.bonus_freezes, FREEZE_MAX_BALANCE);
        const granted = balance - u.streak_freezes;
        u.streak_freezes = balance;
        out.freezeEvents.push({ user_id: u.person.id, type: granted > 0 ? FreezeEventType.EarnedLevel : FreezeEventType.Capped, balance_after: balance, streak_day: null, created_at: at(ms) });
      }
    }
    const extras: string[] = [];
    if (reward && reward.bonus_points > 0)  extras.push(`+${reward.bonus_points} pts`);
    if (reward && reward.bonus_freezes > 0) extras.push(`+${reward.bonus_freezes} freeze${reward.bonus_freezes > 1 ? 's' : ''}`);
    notify(u, NotificationType.LevelUp, `Você alcançou o nível ${calculated}!`,
      extras.length > 0 ? `Recompensa de nível: ${extras.join(' · ')}` : null, null, ms);
  };

  /** Tags do perfil comportamental no instante `ms` (o sistema calcula ao criar a meta) */
  const tagsAt = (u: UserState, ms: number) => {
    const mine = planned.filter((pt) => pt.userId === u.person.id && pt.createdAt <= ms);
    return behavioralTags({
      completedLast90: u.completed.filter((c) => c.completedAt! > ms - 90 * DAY).map((c) => c.row),
      currentStreak: u.current_streak,
      totalTasks: mine.length,
      overdueCount: mine.filter((pt) =>
        pt.dueAt !== null && nextFullHour(pt.dueAt) <= ms
        && (pt.completedAt === null || pt.completedAt > ms)
        && (pt.abandonedAt === null || pt.abandonedAt > ms)).length,
    });
  };

  /** getOrCreateWeeklyGoal: calcula a meta na primeira vez que é pedida na semana */
  const goalFor = (u: UserState, ms: number) => {
    const weekStart = utcWeekStart(new Date(ms));
    const key = weekStart.toISOString().slice(0, 10);
    const existing = u.goals.get(key);
    if (existing) return existing;

    const completeWeeks = countCompleteWeeks(new Date(u.joinedAt), weekStart);
    const weeksUsed = Math.min(completeWeeks, 4);
    const weeklyCounts = Array.from({ length: weeksUsed }, (_, i) => {
      const from = weekStart.getTime() - (i + 1) * WEEK;
      return u.completed.filter((c) => c.completedAt! >= from && c.completedAt! < from + WEEK).length;
    });
    const previousGoals = [1, 2].map((i) => {
      const g = u.goals.get(new Date(weekStart.getTime() - i * WEEK).toISOString().slice(0, 10));
      return g ? { achieved: g.achieved_at !== null } : null;
    });
    const calc = calculateWeeklyGoal({ completeWeeks, weeklyCounts, previousGoals, tags: tagsAt(u, ms) });
    const goal = {
      id: rng.uuid(), user_id: u.person.id, week_start: key, target: calc.target, base_average: calc.baseAverage,
      factor: calc.factor, reason: calc.reason, reward_points: calc.rewardPoints, achieved_at: null as string | null, created_at: at(ms),
    };
    u.goals.set(key, goal);
    out.weeklyGoals.push(goal);
    return goal;
  };

  const completeMissionForGroup = (m: SimMission, actor: UserState, ms: number) => {
    const group = input.groups.find((g) => g.id === m.groupId)!;
    const parts = participants.get(m.row.id)!;
    const rewarded: UserState[] = [];
    for (const [memberId, member] of group.members) {
      const member_ = users.get(memberId);
      if (!member_ || member.joinedAt > ms) continue;
      const p = parts.get(memberId);
      if (p?.completed) continue;
      if (p) { p.completed = true; p.completedAt = ms; }
      else parts.set(memberId, { current: 0, completed: true, completedAt: ms, joinedAt: ms });
      rewarded.push(member_);
    }
    for (const r of rewarded) {
      r.groupMissionsCompleted++;
      if (m.reward > 0) tx(r, m.reward, PointReason.MissionReward, m.row.id, ms);
    }
    // completeGroupMissionForAllMembers verifica conquistas de todos os recompensados
    for (const r of rewarded) checkAchievements(r, ms);
    void actor;
  };

  /** Eventos ordenados: conclusões e "armar freeze" antes de pausas */
  type Ev = { at: number; kind: 'complete'; task: PlannedTask } | { at: number; kind: 'arm'; userId: string };
  const events: Ev[] = planned.filter((pt) => pt.completedAt !== null).map((task) => ({ at: task.completedAt!, kind: 'complete' as const, task }));
  for (const [userId, days] of activeDays) {
    const u = users.get(userId)!;
    for (let i = 0; i < days.length - 1; i++) {
      const gap = Math.round((Date.parse(days[i + 1]!) - Date.parse(days[i]!)) / DAY);
      if (gap >= 2 && rng.chance(u.tuning.armChance)) {
        events.push({ at: Date.parse(days[i]!) + 23 * HOUR + 40 * 60_000, kind: 'arm', userId });
      }
    }
  }
  events.sort((a, b) => a.at - b.at);

  for (const ev of events) {
    if (ev.kind === 'arm') {
      const u = users.get(ev.userId)!;
      if (u.streak_freezes > 0 && !u.freeze_armed_at && ev.at < now) {
        u.freeze_armed_at = iso(ev.at);
        out.freezeEvents.push({ user_id: u.person.id, type: FreezeEventType.Armed, balance_after: u.streak_freezes, streak_day: null, created_at: iso(ev.at) });
      }
      continue;
    }

    const { task } = ev;
    const u = users.get(task.userId)!;
    const ms = task.completedAt!;
    const previousCompletionAt = u.lastCompletionAt;

    // Passo 3 do completeTask: pontos pela mesma função do sistema (calculateTaskPoints)
    let delivery: TaskDelivery;
    if (task.dueAt === null) {
      delivery = { kind: 'no_deadline' };
    } else if (ms <= task.dueAt) {
      delivery = { kind: 'on_time' };
    } else {
      const overdueSince = ms >= nextFullHour(task.dueAt) ? nextFullHour(task.dueAt) : null;
      task.row.overdue_since = overdueSince === null ? null : iso(overdueSince);
      delivery = { kind: 'late', hoursLate: Math.max(0, (ms - (overdueSince ?? task.dueAt)) / HOUR) };
    }
    const points = calculateTaskPoints(task.row.difficulty, task.row.priority, delivery);
    tx(u, points, PointReason.TaskCompleted, task.row.id, ms);
    task.row.status = 'completed';
    task.row.completed_at = iso(ms);
    task.row.points_earned = points;
    task.row.updated_at = iso(ms);
    u.completed.push(task);
    u.lastCompletionAt = ms;

    // Passo 6: sequência
    const streak = applyStreakUpdate(u, ms);
    for (const e of streak.events) out.freezeEvents.push({ user_id: u.person.id, ...e, created_at: at(ms) });
    if (streak.bonus > 0) tx(u, streak.bonus, PointReason.StreakBonus, null, ms);

    // Passo 7: missões (auto-inscrição + progresso + conclusão coletiva)
    for (const g of groupsOf(u.person.id, ms)) {
      for (const m of missions) {
        if (m.groupId !== g.id || m.createdAt > ms || m.expiresAt <= ms) continue;
        const parts = participants.get(m.row.id)!;
        if (!parts.has(u.person.id)) parts.set(u.person.id, { current: 0, completed: false, completedAt: null, joinedAt: m.createdAt });
      }
    }
    for (const m of missions) {
      const p = participants.get(m.row.id)!.get(u.person.id);
      if (!p || p.completed || m.expiresAt <= ms) continue;
      const newValue = u.completed.filter((c) => c.row.group_id === m.groupId && c.completedAt! >= p.joinedAt).length;
      if (newValue <= p.current) continue;
      p.current = newValue;
      const total = [...participants.get(m.row.id)!.values()].reduce((s, x) => s + x.current, 0);
      if (total >= m.target) completeMissionForGroup(m, u, ms);
    }

    // Passos 7b/7c: bônus de retomada e meta semanal
    if (isComebackEligible(previousCompletionAt === null ? null : new Date(previousCompletionAt), u.lastComebackAt === null ? null : new Date(u.lastComebackAt), new Date(ms))) {
      const bonus = calculateComebackBonus(points);
      const daysInactive = Math.floor((ms - previousCompletionAt!) / DAY);
      tx(u, bonus, PointReason.ComebackBonus, task.row.id, ms);
      notify(u, NotificationType.Comeback, 'Bem-vindo de volta!',
        `Você voltou depois de ${daysInactive} dias sem concluir tarefas: +${bonus} pts de bônus de retomada.`, task.row.id, ms);
      u.lastComebackAt = ms;
    }
    const goal = goalFor(u, ms);
    if (!goal.achieved_at) {
      const weekStart = Date.parse(`${goal.week_start}T00:00:00.000Z`);
      const doneThisWeek = u.completed.filter((c) => c.completedAt! >= weekStart && c.completedAt! < weekStart + WEEK).length;
      if (doneThisWeek >= goal.target) {
        goal.achieved_at = at(ms);
        if (goal.reward_points > 0) tx(u, goal.reward_points, PointReason.WeeklyGoalReward, goal.id, ms);
        notify(u, NotificationType.WeeklyGoal, 'Meta da semana batida!',
          `Você concluiu ${goal.target} tarefas esta semana: +${goal.reward_points} pts de bônus.`, goal.id, ms);
      }
    }

    // Passos 8 e 9: conquistas e nível
    checkAchievements(u, ms);
    checkLevelUp(u, ms);
  }

  // Meta da semana atual de quem usou o app nas últimas duas semanas (criada ao abrir o Início)
  for (const u of users.values()) {
    if (u.lastCompletionAt !== null && u.lastCompletionAt > now - 14 * DAY) goalFor(u, now - 5 * 60_000);
  }

  // ── 4. Saída ───────────────────────────────────────────────────────────────

  for (const pt of planned) {
    if (pt.row.status === 'overdue' && pt.dueAt !== null) pt.row.overdue_since = iso(nextFullHour(pt.dueAt));
    if (pt.row.status === 'abandoned' && pt.abandonedAt !== null) pt.row.updated_at = iso(Math.min(pt.abandonedAt, now));
    pt.row.due_date = pt.dueAt === null ? null : iso(pt.dueAt);
    pt.row.created_at = iso(pt.createdAt);
    if (pt.row.status !== 'completed' && pt.row.status !== 'abandoned') pt.row.updated_at = iso(pt.createdAt);
    out.tasks.push(pt.row);
    if (pt.row.requires_proof && pt.completedAt !== null) {
      out.proofs.push({ taskId: pt.row.id, userId: pt.userId, createdAt: iso(pt.completedAt - rng.int(2, 40) * 60_000) });
    }
  }

  for (const m of missions) {
    for (const [userId, p] of participants.get(m.row.id)!) {
      out.participants.push({
        mission_id: m.row.id, user_id: userId, current_value: p.current, is_completed: p.completed,
        completed_at: p.completedAt === null ? null : iso(p.completedAt), joined_at: iso(p.joinedAt),
      });
    }
  }

  for (const u of users.values()) {
    out.profiles.push({
      id: u.person.id, created_at: iso(u.joinedAt), level: u.level, total_points: u.points,
      current_streak: u.current_streak, longest_streak: u.longest_streak, last_active_date: u.last_active_date,
      streak_freezes: u.streak_freezes, freeze_armed_at: u.freeze_armed_at, freeze_streak_credited: u.freeze_streak_credited,
    });
  }

  return out;
}
