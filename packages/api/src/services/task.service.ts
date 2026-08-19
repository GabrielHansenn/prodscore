import {
  TaskDifficulty,
  TaskPriority,
  TaskStatus,
  PointReason,
  type Task,
  type Achievement,
  type LevelReward,
} from '@prodscore/shared';
import { applyLatePenalty } from '@prodscore/shared/constants';
import { supabase } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';
import {
  calculatePoints,
  recordTransaction,
  updateStreak,
  checkLevelUp,
  checkAchievements,
} from './gamification.service.js';
import { checkMissionProgress } from './mission.service.js';
import { purgeProofFileForTask } from './proof.service.js';

// ---------------------------------------------------------------------------
// Tipos internos (linha do banco em snake_case)
// ---------------------------------------------------------------------------

interface TaskRow {
  id: string;
  user_id: string;
  group_id: string | null;
  title: string;
  description: string | null;
  difficulty: string;
  priority: string;
  estimated_minutes: number | null;
  status: string;
  due_date: string | null;
  overdue_since: string | null;
  completed_at: string | null;
  points_earned: number | null;
  created_at: string;
  updated_at: string;
  requires_proof?: boolean;
  // Presente apenas quando a query usa o embed `task_proofs(id)` do Supabase
  // (foreign table embedding via FK) — ausente em updates/inserts que não pedem o join.
  // Objeto único (não array): task_proofs.task_id tem UNIQUE, então o
  // PostgREST detecta a relação como to-one e embeda um objeto ou null.
  task_proofs?: { id: string } | null;
}

/** Converte a linha do banco (snake_case) para a interface Task (camelCase) */
export function mapTaskRow(row: TaskRow): Task {
  return {
    id:               row.id,
    userId:           row.user_id,
    groupId:          row.group_id,
    title:            row.title,
    description:      row.description,
    difficulty:       row.difficulty as TaskDifficulty,
    priority:         (row.priority ?? 'medium') as TaskPriority,
    estimatedMinutes: row.estimated_minutes,
    status:           row.status as TaskStatus,
    dueDate:          row.due_date,
    overdueSince:     row.overdue_since,
    completedAt:      row.completed_at,
    pointsEarned:     row.points_earned,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
    requiresProof:    row.requires_proof ?? false,
    hasProof:         row.task_proofs != null,
  };
}

// ---------------------------------------------------------------------------
// Filtros de listagem
// ---------------------------------------------------------------------------

/** Opções de filtragem para GET /tasks */
export interface TaskFilters {
  status?:     TaskStatus;
  difficulty?: TaskDifficulty;
  priority?:   TaskPriority;
  groupId?:    string;
}

// ---------------------------------------------------------------------------
// Dados de entrada para criação
// ---------------------------------------------------------------------------

export interface CreateTaskInput {
  userId:            string;
  title:             string;
  description?:      string;
  difficulty:        TaskDifficulty;
  priority?:         TaskPriority;
  estimatedMinutes?: number;
  dueDate?:          string;
  groupId?:          string;
  /** Se true, a tarefa só pode ser concluída com uma foto de comprovação anexada */
  requiresProof?:    boolean;
}

// ---------------------------------------------------------------------------
// Resultado da conclusão
// ---------------------------------------------------------------------------

export interface CompleteTaskResult {
  /** Tarefa com status atualizado */
  task:             Task;
  /** Pontos efetivamente ganhos (após bônus ou penalidade) */
  pointsEarned:     number;
  /** Novo valor do streak após a conclusão */
  newStreak:        number;
  /** Se o usuário subiu de nível */
  leveledUp:        boolean;
  /** Novo nível do usuário */
  newLevel:         number;
  /** Marco de streak atingido (null se nenhum) */
  milestoneReached: number | null;
  /** Conquistas desbloqueadas nesta ação */
  newAchievements:  Achievement[];
  /** Se um freeze de streak foi consumido automaticamente nesta ação */
  freezeUsed:       boolean;
  /** Recompensa de nível concedida (null se não subiu de nível ou não há recompensa) */
  levelReward:      LevelReward | null;
}

// ---------------------------------------------------------------------------
// Listagem
// ---------------------------------------------------------------------------

/**
 * Retorna as tarefas de um usuário com filtros opcionais.
 * Ordenadas da mais recente para a mais antiga.
 *
 * @param userId  - UUID do usuário dono das tarefas
 * @param filters - Filtros opcionais por status, dificuldade ou grupo
 */
export async function getTasksByUser(
  userId: string,
  filters?: TaskFilters,
): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    // Embed de task_proofs(id) via FK — usado só para computar hasProof,
    // sem precisar de uma query separada por tarefa.
    .select('*, task_proofs(id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filters?.status !== undefined) {
    query = query.eq('status', filters.status);
  }

  if (filters?.difficulty !== undefined) {
    query = query.eq('difficulty', filters.difficulty);
  }

  if (filters?.priority !== undefined) {
    query = query.eq('priority', filters.priority);
  }

  if (filters?.groupId !== undefined) {
    query = query.eq('group_id', filters.groupId);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('Erro ao buscar tarefas.', 500, 'BUSCA_FALHOU');
  }

  return (data as TaskRow[]).map(mapTaskRow);
}

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

/**
 * Cria uma nova tarefa para o usuário com status 'pending'.
 *
 * Validações (executadas no nível do banco via constraints):
 * - título: 1 a 255 caracteres
 * - Se groupId informado, verifica se o usuário é membro do grupo
 *
 * @param input - Dados da nova tarefa
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  // Se groupId foi informado, verifica se o usuário é membro do grupo
  if (input.groupId !== undefined) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', input.groupId)
      .eq('user_id', input.userId)
      .maybeSingle();

    if (!membership) {
      throw new AppError(
        'Você não é membro deste grupo.',
        403,
        'NAO_MEMBRO_DO_GRUPO',
      );
    }
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id:           input.userId,
      group_id:          input.groupId          ?? null,
      title:             input.title,
      description:       input.description      ?? null,
      difficulty:        input.difficulty,
      priority:          input.priority          ?? TaskPriority.Medium,
      estimated_minutes: input.estimatedMinutes  ?? null,
      status:            'pending',
      due_date:          input.dueDate           ?? null,
      requires_proof:    input.requiresProof      ?? false,
    })
    .select('*')
    .single();

  if (error || !data) {
    // Log só no servidor — o motivo real nunca deve chegar na resposta ao cliente
    console.error('[task.service.createTask] insert falhou:', error, { input });
    throw new AppError('Erro ao criar tarefa.', 500, 'CRIACAO_FALHOU');
  }

  return mapTaskRow(data as TaskRow);
}

// ---------------------------------------------------------------------------
// Atualização parcial
// ---------------------------------------------------------------------------

/** Campos que podem ser atualizados manualmente */
export interface UpdateTaskInput {
  title?:            string;
  description?:      string | null;
  difficulty?:       TaskDifficulty;
  priority?:         TaskPriority;
  estimatedMinutes?: number | null;
  /** A proteção contra 'completed' é feita em runtime — use PATCH /complete para concluir */
  status?:           TaskStatus;
  dueDate?:          string | null;
  requiresProof?:    boolean;
}

/**
 * Atualiza campos editáveis de uma tarefa.
 * Apenas o dono pode atualizar; tarefas já concluídas não podem ser editadas.
 *
 * @param taskId  - UUID da tarefa
 * @param userId  - UUID do usuário (verifica ownership)
 * @param updates - Campos a atualizar (pelo menos um obrigatório)
 */
export async function updateTask(
  taskId: string,
  userId: string,
  updates: UpdateTaskInput,
): Promise<Task> {
  // Busca a tarefa verificando ownership em uma única query
  const { data: existing, error: fetchError } = await supabase
    .from('tasks')
    .select('id, status, user_id')
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    throw new AppError('Erro ao buscar tarefa.', 500);
  }

  if (!existing) {
    throw new AppError('Tarefa não encontrada.', 404, 'TAREFA_NAO_ENCONTRADA');
  }

  const row = existing as Pick<TaskRow, 'id' | 'status' | 'user_id'>;

  if (row.status === 'completed') {
    throw new AppError(
      'Tarefas concluídas não podem ser editadas.',
      409,
      'TAREFA_JA_CONCLUIDA',
    );
  }

  // Monta o objeto de atualização apenas com os campos presentes
  const patch: Record<string, unknown> = {};
  if (updates.title            !== undefined) patch['title']             = updates.title;
  if (updates.description      !== undefined) patch['description']       = updates.description;
  if (updates.difficulty       !== undefined) patch['difficulty']        = updates.difficulty;
  if (updates.priority         !== undefined) patch['priority']          = updates.priority;
  if (updates.estimatedMinutes !== undefined) patch['estimated_minutes'] = updates.estimatedMinutes;
  if (updates.status           !== undefined) patch['status']            = updates.status;
  if (updates.dueDate          !== undefined) patch['due_date']          = updates.dueDate;
  if (updates.requiresProof    !== undefined) patch['requires_proof']    = updates.requiresProof;

  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId)
    // Mesmo motivo do embed em completeTask — evita que hasProof volte
    // errado (false) na resposta usada pra atualizar o estado local.
    .select('*, task_proofs(id)')
    .single();

  if (error || !data) {
    throw new AppError('Erro ao atualizar tarefa.', 500, 'ATUALIZACAO_FALHOU');
  }

  return mapTaskRow(data as TaskRow);
}

// ---------------------------------------------------------------------------
// Exclusão
// ---------------------------------------------------------------------------

/**
 * Remove permanentemente uma tarefa.
 * Apenas o dono pode excluir; tarefas concluídas também podem ser excluídas.
 *
 * @param taskId - UUID da tarefa
 * @param userId - UUID do usuário (verifica ownership)
 */
export async function deleteTask(taskId: string, userId: string): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    throw new AppError('Erro ao buscar tarefa.', 500);
  }

  if (!existing) {
    throw new AppError('Tarefa não encontrada.', 404, 'TAREFA_NAO_ENCONTRADA');
  }

  // Remove o arquivo de comprovação do Storage antes de excluir a tarefa
  // (LGPD: o registro em task_proofs cai via ON DELETE CASCADE, mas o
  // arquivo em si não é apagado automaticamente pelo cascade do Postgres).
  await purgeProofFileForTask(taskId);

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    throw new AppError('Erro ao excluir tarefa.', 500, 'EXCLUSAO_FALHOU');
  }
}

// ---------------------------------------------------------------------------
// Conclusão (fluxo principal com gamificação)
// ---------------------------------------------------------------------------

/**
 * Marca uma tarefa como concluída e dispara o pipeline de gamificação.
 *
 * Passos executados em sequência:
 * 1. Busca a tarefa e verifica ownership e que não está concluída
 * 2. Determina se foi entregue no prazo (now <= due_date)
 * 3. Calcula os pontos com bônus ou penalidade
 * 4. Registra a transação de pontos no ledger
 * 5. Atualiza a tarefa: status, completed_at, points_earned
 * 6. Atualiza o streak do usuário (e concede bônus de marco se aplicável)
 * 7. Verifica se o usuário subiu de nível
 * 8. Verifica e desbloqueia novas conquistas
 * 9. Retorna resultado consolidado
 *
 * @param taskId - UUID da tarefa a concluir
 * @param userId - UUID do usuário autenticado (deve ser o dono)
 */
export async function completeTask(
  taskId: string,
  userId: string,
): Promise<CompleteTaskResult> {
  // ── Passo 1: busca e validações ──────────────────────────────────────────

  const { data: taskData, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('user_id', userId)  // ownership verificado na query
    .maybeSingle();

  if (taskError) {
    throw new AppError('Erro ao buscar tarefa.', 500);
  }

  if (!taskData) {
    throw new AppError('Tarefa não encontrada.', 404, 'TAREFA_NAO_ENCONTRADA');
  }

  const taskRow = taskData as TaskRow;

  if (taskRow.status === 'completed') {
    throw new AppError(
      'Esta tarefa já foi concluída.',
      409,
      'TAREFA_JA_CONCLUIDA',
    );
  }

  // ── Passo 1b: exige comprovação fotográfica? ─────────────────────────────
  // Guarda pura — não interfere no cálculo de pontos abaixo. Roda antes de
  // qualquer efeito colateral (transação, streak, conquistas), então uma
  // tentativa sem prova não deixa nenhum rastro parcial.

  if (taskRow.requires_proof) {
    const { data: proof, error: proofError } = await supabase
      .from('task_proofs')
      .select('id')
      .eq('task_id', taskId)
      .maybeSingle();

    if (proofError) {
      throw new AppError('Erro ao verificar comprovação da tarefa.', 500);
    }
    if (!proof) {
      throw new AppError(
        'Esta tarefa exige uma foto de comprovação antes de ser concluída.',
        400,
        'PROVA_OBRIGATORIA',
      );
    }
  }

  // ── Passo 2: pontualidade ─────────────────────────────────────────────────

  const now = new Date();
  let isOnTime: boolean | null = null;

  if (taskRow.due_date !== null) {
    isOnTime = now <= new Date(taskRow.due_date);
  }

  // ── Passo 3: cálculo de pontos ────────────────────────────────────────────
  //
  // Para tarefas entregues no prazo ou sem prazo: usa calculatePoints diretamente.
  // Para tarefas atrasadas: aplica penalidade PROGRESSIVA baseada em quanto tempo
  // está overdue (substituindo a penalidade fixa de -30%).

  const priority = (taskRow.priority ?? 'medium') as TaskPriority;

  let pointsEarned: number;
  if (isOnTime !== false) {
    // Sem due_date (null) ou entregue antes do prazo (true)
    pointsEarned = calculatePoints(taskRow.difficulty as TaskDifficulty, isOnTime, priority);
  } else {
    // Atrasada: base × prioridade, sem modificador de prazo
    const baseWithPriority = calculatePoints(taskRow.difficulty as TaskDifficulty, null, priority);

    // Horas desde que ficou overdue (fallback: desde a due_date)
    const overdueRef = taskRow.overdue_since
      ? new Date(taskRow.overdue_since)
      : new Date(taskRow.due_date!);
    const hoursOverdue = Math.max(0, (now.getTime() - overdueRef.getTime()) / 3_600_000);

    pointsEarned = applyLatePenalty(baseWithPriority, hoursOverdue);
  }

  const completedAt = now.toISOString();

  // ── Passo 4: transação de pontos ──────────────────────────────────────────

  await recordTransaction(
    userId,
    pointsEarned,
    PointReason.TaskCompleted,
    taskId,
  );

  // ── Passo 5: atualiza a tarefa ────────────────────────────────────────────

  const { data: updatedData, error: updateError } = await supabase
    .from('tasks')
    .update({
      status:       'completed',
      completed_at:  completedAt,
      points_earned: pointsEarned,
    })
    .eq('id', taskId)
    // Embed de task_proofs(id) — sem isso hasProof volta false mesmo quando a
    // prova foi confirmada no passo 1b, escondendo o botão "Ver comprovação"
    // até o próximo refresh da lista completa (que já embeda corretamente).
    .select('*, task_proofs(id)')
    .single();

  if (updateError || !updatedData) {
    throw new AppError(
      'Tarefa não pôde ser marcada como concluída.',
      500,
      'ATUALIZACAO_FALHOU',
    );
  }

  const completedTask = mapTaskRow(updatedData as TaskRow);

  // ── Passos 6–8: gamificação (sequencial — cada passo pode alterar total_points) ──
  //
  // Ordem importa:
  //   6. updateStreak   → pode adicionar bônus de marco
  //   7. checkAchievements → pode adicionar bônus de conquista
  //   8. checkLevelUp   → lê o total_points final para calcular o nível correto

  const streakResult     = await updateStreak(userId);
  const newAchievements  = await checkAchievements(userId);
  const levelResult      = await checkLevelUp(userId);

  // ── Passo 9: progresso de missões ─────────────────────────────────────────
  // Fire-and-forget: falha não interrompe a conclusão da tarefa
  checkMissionProgress(userId).catch((err) => {
    console.error('[tarefas] Erro ao verificar progresso de missões:', err);
  });

  // ── Passo 10: retorno ─────────────────────────────────────────────────────

  return {
    task:             completedTask,
    pointsEarned,
    newStreak:        streakResult.newStreak,
    leveledUp:        levelResult.leveledUp,
    newLevel:         levelResult.newLevel,
    milestoneReached: streakResult.milestoneReached,
    newAchievements,
    freezeUsed:       streakResult.freezeUsed,
    levelReward:      levelResult.levelReward,
  };
}
