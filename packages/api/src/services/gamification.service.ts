import {
  TaskDifficulty,
  TaskPriority,
  PointReason,
  type Achievement,
  type LevelReward,
  type PointTransaction,
  type User,
} from '@prodscore/shared';
import {
  POINTS_BY_DIFFICULTY,
  PRIORITY_MULTIPLIERS,
  LATE_PENALTY_MULTIPLIER,
  ON_TIME_BONUS_MULTIPLIER,
  STREAK_MILESTONES,
  STREAK_MILESTONE_BONUS,
  FREEZE_PER_MILESTONE,
  FREEZE_COST_POINTS,
  levelThreshold,
} from '@prodscore/shared/constants';
import { supabase } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Tipos internos para linhas do banco (snake_case → sem depender de tipos gerados)
// ---------------------------------------------------------------------------

interface ProfileRow {
  id: string;
  level: number;
  total_points: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  streak_freezes: number;
}

interface LevelRewardRow {
  level:         number;
  bonus_points:  number;
  bonus_freezes: number;
  badge_key:     string | null;
  description:   string;
}

interface AchievementRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  reward_points: number;
  created_at: string;
  /** Critério armazenado como JSONB no banco */
  criteria: { type: string; threshold: number };
}

// ---------------------------------------------------------------------------
// Pontuação
// ---------------------------------------------------------------------------

/**
 * Calcula os pontos ganhos ao concluir uma tarefa.
 *
 * Fórmula: base × modificador_pontualidade × multiplicador_prioridade
 *
 * - base               → definida pela dificuldade (easy=10, medium=25, hard=50, epic=100)
 * - modificador_prazo  → +20% (no prazo) | -30% (atrasada) | ×1 (sem prazo)
 * - multiplicador_prio → low=0.90 | medium=1.00 | high=1.10 | urgent=1.25
 *
 * O resultado é arredondado para baixo (floor) para evitar frações de ponto.
 *
 * @param difficulty - Dificuldade da tarefa (define a pontuação base)
 * @param isOnTime   - Entregue no prazo? null se a tarefa não tem due_date
 * @param priority   - Urgência de negócio (default: medium = sem modificação)
 */
export function calculatePoints(
  difficulty: TaskDifficulty,
  isOnTime: boolean | null,
  priority: TaskPriority = TaskPriority.Medium,
): number {
  const base     = POINTS_BY_DIFFICULTY[difficulty];
  const prioMult = PRIORITY_MULTIPLIERS[priority];

  let timeModified: number;
  if (isOnTime === true) {
    timeModified = base * (1 + ON_TIME_BONUS_MULTIPLIER);
  } else if (isOnTime === false) {
    timeModified = base * (1 - LATE_PENALTY_MULTIPLIER);
  } else {
    timeModified = base;
  }

  return Math.floor(timeModified * prioMult);
}

// ---------------------------------------------------------------------------
// Transações de pontos
// ---------------------------------------------------------------------------

/**
 * Registra uma movimentação de pontos no ledger e atualiza o total do perfil.
 *
 * As operações são feitas em sequência (não em uma transação SQL explícita):
 * INSERT em point_transactions → UPDATE em profiles.total_points.
 * Em caso de falha no UPDATE, o INSERT já terá ocorrido — risco aceitável
 * para o escopo do TCC (correção real exigiria transação PostgreSQL via RPC).
 *
 * @param userId      - UUID do usuário que recebe/perde pontos
 * @param amount      - Quantidade de pontos (positivo = ganho, negativo = perda)
 * @param reason      - Motivo da transação
 * @param referenceId - UUID da entidade de origem (tarefa, missão, conquista)
 */
export async function recordTransaction(
  userId: string,
  amount: number,
  reason: PointReason,
  referenceId?: string,
): Promise<PointTransaction> {
  // Insere o registro imutável no ledger de pontos
  const { data: txRow, error: txError } = await supabase
    .from('point_transactions')
    .insert({
      user_id:      userId,
      amount,
      reason,
      reference_id: referenceId ?? null,
    })
    .select('id, user_id, amount, reason, reference_id, created_at')
    .single();

  if (txError || !txRow) {
    throw new AppError(
      'Erro ao registrar transação de pontos.',
      500,
      'TRANSACAO_FALHOU',
    );
  }

  // Incrementa total_points atomicamente via função PostgreSQL (ver 007_functions.sql).
  // GREATEST(0, total + amount) garante que o saldo nunca fique negativo.
  const { error: rpcError } = await supabase.rpc('increment_total_points', {
    p_user_id: userId,
    p_amount:  amount,
  });

  if (rpcError) {
    // Transação registrada mas saldo não atualizado — logar para investigação.
    console.error('[gamificação] Falha ao atualizar total_points:', rpcError.message);
  }

  const row = txRow as {
    id: string; user_id: string; amount: number;
    reason: string; reference_id: string | null; created_at: string;
  };

  return {
    id:          row.id,
    userId:      row.user_id,
    amount:      row.amount,
    reason:      row.reason as PointReason,
    referenceId: row.reference_id,
    createdAt:   row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

/**
 * Atualiza a sequência de produtividade (streak) do usuário após concluir uma tarefa.
 *
 * Lógica de atualização:
 * - last_active_date = hoje          → já registrou hoje, sem alteração
 * - daysSinceActive = 1 (ontem)      → dia consecutivo, incrementa
 * - daysSinceActive = 2 + tem freeze → consome 1 freeze e protege o streak atual
 * - daysSinceActive > 2 ou sem freeze → reset para 1
 * - last_active_date = null          → primeira atividade (inicia em 1)
 *
 * Marco de streak: ao atingir um valor em STREAK_MILESTONES,
 * concede STREAK_MILESTONE_BONUS pontos + FREEZE_PER_MILESTONE freeze extras.
 *
 * Nota: sem lock distribuído, duas requisições paralelas no mesmo dia podem
 * causar duplo incremento. Aceitável para o escopo deste TCC.
 *
 * @param userId - UUID do usuário
 * @returns Novo streak, marco atingido (null se nenhum) e se um freeze foi consumido
 */
export async function updateStreak(userId: string): Promise<{
  newStreak:        number;
  milestoneReached: number | null;
  freezeUsed:       boolean;
}> {
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('current_streak, longest_streak, last_active_date, streak_freezes')
    .eq('id', userId)
    .single();

  if (profileError || !profileData) {
    throw new AppError('Perfil não encontrado ao atualizar streak.', 404);
  }

  const profile = profileData as Pick<
    ProfileRow,
    'current_streak' | 'longest_streak' | 'last_active_date' | 'streak_freezes'
  >;

  const today    = new Date().toISOString().split('T')[0]!;
  const lastActive = profile.last_active_date;

  // Já registrou atividade hoje — nada a fazer
  if (lastActive === today) {
    return { newStreak: profile.current_streak, milestoneReached: null, freezeUsed: false };
  }

  // Calcula quantos dias se passaram desde a última atividade
  const daysSinceActive = lastActive
    ? Math.round((new Date(today).getTime() - new Date(lastActive).getTime()) / 86_400_000)
    : Infinity;

  // ── Freeze automático: perdeu exatamente 1 dia e tem freeze disponível ─────
  if (daysSinceActive === 2 && profile.streak_freezes > 0) {
    const { error: freezeError } = await supabase
      .from('profiles')
      .update({
        streak_freezes:  profile.streak_freezes - 1,
        last_active_date: today,
      })
      .eq('id', userId);

    if (freezeError) {
      console.error('[gamificação] Erro ao consumir freeze de streak:', freezeError.message);
    } else {
      console.log(`[gamificação] Freeze de streak consumido para usuário ${userId} (streak preservado: ${profile.current_streak} dias)`);
    }

    return { newStreak: profile.current_streak, milestoneReached: null, freezeUsed: true };
  }

  // ── Cálculo do novo streak ────────────────────────────────────────────────
  const newStreak  = daysSinceActive === 1 ? profile.current_streak + 1 : 1;
  const newLongest = Math.max(newStreak, profile.longest_streak);

  const milestoneReached = (STREAK_MILESTONES as readonly number[]).includes(newStreak)
    ? newStreak
    : null;

  // Persiste streak + concede freeze extra se atingiu marco
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      current_streak:   newStreak,
      longest_streak:   newLongest,
      last_active_date: today,
      ...(milestoneReached !== null
        ? { streak_freezes: profile.streak_freezes + FREEZE_PER_MILESTONE }
        : {}),
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[gamificação] Erro ao atualizar streak:', updateError.message);
  }

  // Bônus de pontos para marcos de streak
  if (milestoneReached !== null) {
    try {
      await recordTransaction(userId, STREAK_MILESTONE_BONUS, PointReason.StreakBonus);
      console.log(`[gamificação] Marco ${milestoneReached} dias → +${STREAK_MILESTONE_BONUS} pts, +${FREEZE_PER_MILESTONE} freeze`);
    } catch (err) {
      console.error('[gamificação] Erro ao registrar bônus de streak:', err);
    }
  }

  return { newStreak, milestoneReached, freezeUsed: false };
}

// ---------------------------------------------------------------------------
// Compra de streak freeze
// ---------------------------------------------------------------------------

/**
 * Debita FREEZE_COST_POINTS do usuário e concede 1 streak freeze.
 * Lança AppError se o usuário não tiver pontos suficientes.
 *
 * @param userId - UUID do usuário
 */
export async function buyStreakFreeze(userId: string): Promise<void> {
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('total_points, streak_freezes')
    .eq('id', userId)
    .single();

  if (profileError || !profileData) {
    throw new AppError('Perfil não encontrado.', 404);
  }

  const profile = profileData as Pick<ProfileRow, 'total_points' | 'streak_freezes'>;

  if (profile.total_points < FREEZE_COST_POINTS) {
    throw new AppError(
      `Pontos insuficientes. Necessário: ${FREEZE_COST_POINTS} pts. Você tem: ${profile.total_points} pts.`,
      400,
      'PONTOS_INSUFICIENTES',
    );
  }

  // Debita os pontos (recordTransaction atualiza total_points via RPC)
  await recordTransaction(userId, -FREEZE_COST_POINTS, PointReason.FreezeShop);

  // Concede o freeze
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ streak_freezes: profile.streak_freezes + 1 })
    .eq('id', userId);

  if (updateError) {
    console.error('[gamificação] Erro ao conceder freeze de streak:', updateError.message);
    throw new AppError('Erro ao registrar o freeze. Tente novamente.', 500, 'FREEZE_FALHOU');
  }

  console.log(`[gamificação] Freeze comprado pelo usuário ${userId} por ${FREEZE_COST_POINTS} pts`);
}

// ---------------------------------------------------------------------------
// Level up (com recompensas de nível marco)
// ---------------------------------------------------------------------------

/**
 * Verifica se o usuário subiu de nível após acumular novos pontos.
 * Se existir uma recompensa para o novo nível, concede pontos bônus e freezes.
 *
 * Fórmula do threshold: nível² × 100 (ver gamification.ts → levelThreshold)
 *
 * @param userId - UUID do usuário
 * @returns Se subiu de nível, o novo nível e a recompensa concedida (null se não há)
 */
export async function checkLevelUp(
  userId: string,
): Promise<{ leveledUp: boolean; newLevel: number; levelReward: LevelReward | null }> {
  const { data: profileData, error } = await supabase
    .from('profiles')
    .select('level, total_points, streak_freezes')
    .eq('id', userId)
    .single();

  if (error || !profileData) {
    throw new AppError('Perfil não encontrado ao verificar nível.', 404);
  }

  const profile = profileData as Pick<ProfileRow, 'level' | 'total_points' | 'streak_freezes'>;

  // Calcula o nível correto com base nos pontos acumulados
  let calculatedLevel = 1;
  while (profile.total_points >= levelThreshold(calculatedLevel + 1)) {
    calculatedLevel++;
  }

  if (calculatedLevel <= profile.level) {
    return { leveledUp: false, newLevel: profile.level, levelReward: null };
  }

  // Persiste o novo nível
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ level: calculatedLevel })
    .eq('id', userId);

  if (updateError) {
    console.error('[gamificação] Erro ao atualizar nível:', updateError.message);
  } else {
    console.log(`[gamificação] Usuário ${userId} subiu para o nível ${calculatedLevel}!`);
  }

  // Verifica se há recompensa cadastrada para o novo nível
  const { data: rewardData } = await supabase
    .from('level_rewards')
    .select('level, bonus_points, bonus_freezes, badge_key, description')
    .eq('level', calculatedLevel)
    .maybeSingle();

  if (!rewardData) {
    return { leveledUp: true, newLevel: calculatedLevel, levelReward: null };
  }

  const reward = rewardData as LevelRewardRow;
  const levelReward: LevelReward = {
    level:        reward.level,
    bonusPoints:  reward.bonus_points,
    bonusFreezes: reward.bonus_freezes,
    badgeKey:     reward.badge_key,
    description:  reward.description,
  };

  // Concede pontos bônus da recompensa de nível
  if (reward.bonus_points > 0) {
    try {
      await recordTransaction(userId, reward.bonus_points, PointReason.LevelReward);
    } catch (err) {
      console.error('[gamificação] Erro ao conceder pontos de recompensa de nível:', err);
    }
  }

  // Concede freezes bônus da recompensa de nível
  if (reward.bonus_freezes > 0) {
    const { error: freezeError } = await supabase
      .from('profiles')
      .update({ streak_freezes: profile.streak_freezes + reward.bonus_freezes })
      .eq('id', userId);

    if (freezeError) {
      console.error('[gamificação] Erro ao conceder freezes de recompensa de nível:', freezeError.message);
    } else {
      console.log(`[gamificação] Recompensa nível ${calculatedLevel}: +${reward.bonus_points} pts, +${reward.bonus_freezes} freezes`);
    }
  }

  return { leveledUp: true, newLevel: calculatedLevel, levelReward };
}

// ---------------------------------------------------------------------------
// Conquistas — avaliadores extensíveis
// ---------------------------------------------------------------------------

/** Contexto com todas as métricas necessárias para avaliar qualquer conquista */
interface EvalContext {
  tasksCompleted:    number;
  epicCompleted:     number;
  currentStreak:     number;
  groupMembersCount: number;
  totalPoints:       number;
  level:             number;
}

/**
 * Registro de avaliadores de conquistas.
 * Para adicionar um novo tipo de critério, basta inserir uma entrada aqui —
 * nenhuma outra alteração de código é necessária.
 *
 * Cada avaliador recebe o contexto completo de métricas e o threshold
 * definido na conquista, e retorna true se o critério foi atingido.
 */
const ACHIEVEMENT_EVALUATORS = new Map<
  string,
  (ctx: EvalContext, threshold: number) => boolean
>([
  // Tipos originais
  ['tasks_completed',     (ctx, t) => ctx.tasksCompleted    >= t],
  ['streak',              (ctx, t) => ctx.currentStreak     >= t],
  ['epic_task_completed', (ctx, t) => ctx.epicCompleted     >= t],
  ['group_members',       (ctx, t) => ctx.groupMembersCount >= t],
  // Novos tipos — Fase 3 (mecânica 8)
  ['points_earned',       (ctx, t) => ctx.totalPoints       >= t],
  ['level_reached',       (ctx, t) => ctx.level             >= t],
]);

/**
 * Verifica e desbloqueia conquistas para o usuário com base no seu estado atual.
 *
 * Critérios suportados (campo `criteria.type` das conquistas):
 * - tasks_completed:      total de tarefas concluídas
 * - streak:               streak atual
 * - epic_task_completed:  tarefas Epic concluídas
 * - group_members:        membros nos grupos que o usuário é owner
 * - points_earned:        total de pontos acumulados         ← novo (Fase 3)
 * - level_reached:        nível atual do usuário             ← novo (Fase 3)
 *
 * Para cada conquista desbloqueada: insere em user_achievements e
 * registra uma transação de achievement_bonus.
 *
 * @param userId - UUID do usuário
 * @returns Lista de conquistas recém-desbloqueadas (vazia se nenhuma)
 */
export async function checkAchievements(userId: string): Promise<Achievement[]> {
  // Busca IDs das conquistas que o usuário já possui
  const { data: earnedData } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId);

  const earnedIds = (earnedData ?? []).map(
    (row) => (row as { achievement_id: string }).achievement_id,
  );

  // Busca conquistas ainda não desbloqueadas (inclui campo criteria)
  let achievementsQuery = supabase
    .from('achievements')
    .select('id, name, description, icon, reward_points, created_at, criteria');

  if (earnedIds.length > 0) {
    achievementsQuery = achievementsQuery.not(
      'id',
      'in',
      `(${earnedIds.join(',')})`,
    );
  }

  const { data: unearnedData } = await achievementsQuery;
  const unearned = (unearnedData ?? []) as AchievementRow[];

  if (unearned.length === 0) return [];

  // Coleta as métricas necessárias em paralelo
  const [tasksResult, epicResult, profileResult, groupsResult] = await Promise.all([
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed'),

    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .eq('difficulty', 'epic'),

    // Inclui total_points e level para os novos avaliadores (Fase 3)
    supabase
      .from('profiles')
      .select('current_streak, total_points, level')
      .eq('id', userId)
      .single(),

    supabase
      .from('groups')
      .select('id')
      .eq('owner_id', userId),
  ]);

  // Conta membros em todos os grupos do usuário (excluindo o próprio owner)
  let groupMembersCount = 0;
  const groupIds = (groupsResult.data ?? []).map((g) => (g as { id: string }).id);
  if (groupIds.length > 0) {
    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .in('group_id', groupIds)
      .neq('user_id', userId);
    groupMembersCount = count ?? 0;
  }

  type ProfileResult = { current_streak: number; total_points: number; level: number };
  const profileRow = profileResult.data as ProfileResult | null;

  const ctx: EvalContext = {
    tasksCompleted:    tasksResult.count    ?? 0,
    epicCompleted:     epicResult.count     ?? 0,
    currentStreak:     profileRow?.current_streak ?? 0,
    groupMembersCount,
    totalPoints:       profileRow?.total_points   ?? 0,
    level:             profileRow?.level          ?? 1,
  };

  // Avalia cada conquista usando o registro de avaliadores
  const newlyEarned: Achievement[] = [];

  for (const achievement of unearned) {
    const { type, threshold } = achievement.criteria;

    const evaluator = ACHIEVEMENT_EVALUATORS.get(type);
    if (!evaluator) {
      // Tipo desconhecido — ignora sem quebrar o fluxo
      continue;
    }

    if (!evaluator(ctx, threshold)) continue;

    // Registra o desbloqueio
    const { error: insertError } = await supabase
      .from('user_achievements')
      .insert({ user_id: userId, achievement_id: achievement.id });

    if (insertError) {
      console.error(`[gamificação] Erro ao registrar conquista "${achievement.name}":`, insertError.message);
      continue;
    }

    // Concede pontos de recompensa da conquista
    if (achievement.reward_points > 0) {
      try {
        await recordTransaction(
          userId,
          achievement.reward_points,
          PointReason.AchievementBonus,
          achievement.id,
        );
      } catch (err) {
        console.error('[gamificação] Erro ao conceder pontos de conquista:', err);
      }
    }

    console.log(`[gamificação] Conquista desbloqueada: "${achievement.name}" para usuário ${userId}`);

    newlyEarned.push({
      id:           achievement.id,
      name:         achievement.name,
      description:  achievement.description,
      icon:         achievement.icon,
      rewardPoints: achievement.reward_points,
      createdAt:    achievement.created_at,
    });
  }

  return newlyEarned;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Calcula o score de ranking combinando pontos totais com streak atual.
 * O streak recebe um multiplicador de 10 para valorizar consistência.
 *
 * @param user - Dados parciais do usuário
 */
export function calculateRankingScore(
  user: Pick<User, 'totalPoints' | 'currentStreak'>,
): number {
  return user.totalPoints + user.currentStreak * 10;
}
