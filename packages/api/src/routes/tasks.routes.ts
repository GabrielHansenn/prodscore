import { Router } from 'express';
import { z } from 'zod';
import { TaskDifficulty, TaskPriority, TaskStatus } from '@prodscore/shared';
import { authGuard, type AuthenticatedRequest } from '../middleware/auth.js';
import { sendError, AppError } from '../lib/errors.js';
import {
  getTasksByUser,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  type TaskFilters,
} from '../services/task.service.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas de validação (mensagens em português)
// ---------------------------------------------------------------------------

const createTaskSchema = z.object({
  title: z
    .string({ required_error: 'Título é obrigatório.' })
    .min(1,   { message: 'Título é obrigatório.' })
    .max(255, { message: 'O título deve ter no máximo 255 caracteres.' }),

  description: z
    .string()
    .max(2000, { message: 'A descrição deve ter no máximo 2000 caracteres.' })
    .optional(),

  difficulty: z.nativeEnum(TaskDifficulty, {
    errorMap: () => ({
      message: `Dificuldade inválida. Use: ${Object.values(TaskDifficulty).join(', ')}.`,
    }),
  }),

  priority: z.nativeEnum(TaskPriority, {
    errorMap: () => ({
      message: `Prioridade inválida. Use: ${Object.values(TaskPriority).join(', ')}.`,
    }),
  }).optional(),

  estimatedMinutes: z
    .number({ invalid_type_error: 'Tempo estimado deve ser um número.' })
    .int({ message: 'Tempo estimado deve ser um número inteiro.' })
    .min(1, { message: 'Tempo estimado deve ser de pelo menos 1 minuto.' })
    .optional(),

  dueDate: z
    .string()
    .datetime({ message: 'Data de entrega inválida. Use o formato ISO 8601 (ex: 2026-12-31T23:59:00Z).' })
    .refine(
      (date) => new Date(date) > new Date(),
      { message: 'A data de entrega deve ser no futuro.' },
    )
    .optional(),

  groupId: z
    .string()
    .uuid({ message: 'ID do grupo inválido.' })
    .optional(),
});

const updateTaskSchema = z
  .object({
    title: z
      .string()
      .min(1,   { message: 'Título não pode ser vazio.' })
      .max(255, { message: 'O título deve ter no máximo 255 caracteres.' })
      .optional(),

    description: z
      .string()
      .max(2000, { message: 'A descrição deve ter no máximo 2000 caracteres.' })
      .nullable()
      .optional(),

    difficulty: z
      .nativeEnum(TaskDifficulty, {
        errorMap: () => ({ message: `Dificuldade inválida. Use: ${Object.values(TaskDifficulty).join(', ')}.` }),
      })
      .optional(),

    priority: z
      .nativeEnum(TaskPriority, {
        errorMap: () => ({ message: `Prioridade inválida. Use: ${Object.values(TaskPriority).join(', ')}.` }),
      })
      .optional(),

    estimatedMinutes: z
      .number({ invalid_type_error: 'Tempo estimado deve ser um número.' })
      .int({ message: 'Tempo estimado deve ser um número inteiro.' })
      .min(1, { message: 'Tempo estimado deve ser de pelo menos 1 minuto.' })
      .nullable()
      .optional(),

    // Não permite alterar para 'completed' manualmente — use PATCH /tasks/:id/complete
    status: z
      .nativeEnum(TaskStatus, {
        errorMap: () => ({ message: `Status inválido. Valores aceitos: ${Object.values(TaskStatus).join(', ')}.` }),
      })
      .refine(
        (s) => s !== TaskStatus.Completed,
        { message: 'Para marcar como concluída, use PATCH /tasks/:id/complete.' },
      )
      .optional(),

    dueDate: z
      .string()
      .datetime({ message: 'Data de entrega inválida. Use o formato ISO 8601.' })
      .nullable()
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: 'Pelo menos um campo deve ser informado para atualizar.' },
  );

const filterSchema = z.object({
  status:     z.nativeEnum(TaskStatus).optional(),
  difficulty: z.nativeEnum(TaskDifficulty).optional(),
  priority:   z.nativeEnum(TaskPriority).optional(),
  groupId:    z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// GET /tasks
// ---------------------------------------------------------------------------

/**
 * Lista as tarefas do usuário autenticado.
 * Parâmetros de query opcionais: status, difficulty, groupId
 */
router.get('/', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;

    // Valida e extrai filtros dos query params
    const filtersResult = filterSchema.safeParse(req.query);
    const filters: TaskFilters = filtersResult.success ? filtersResult.data : {};

    const tasks = await getTasksByUser(user.id, filters);

    return res.status(200).json({ tarefas: tasks, total: tasks.length });
  } catch (err) {
    return sendError(res, err, '[tarefas/GET]');
  }
});

// ---------------------------------------------------------------------------
// POST /tasks
// ---------------------------------------------------------------------------

/**
 * Cria uma nova tarefa para o usuário autenticado.
 * Status inicial sempre 'pending'; pontos calculados apenas ao concluir.
 */
router.post('/', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const body = createTaskSchema.parse(req.body);

    const task = await createTask({
      userId:            user.id,
      title:             body.title,
      description:       body.description,
      difficulty:        body.difficulty,
      priority:          body.priority,
      estimatedMinutes:  body.estimatedMinutes,
      dueDate:           body.dueDate,
      groupId:           body.groupId,
    });

    return res.status(201).json({ tarefa: task });
  } catch (err) {
    return sendError(res, err, '[tarefas/POST]');
  }
});

// ---------------------------------------------------------------------------
// PATCH /tasks/:id
// ---------------------------------------------------------------------------

/**
 * Atualiza campos editáveis de uma tarefa (title, description, difficulty, status, dueDate).
 * Não permite marcar como 'completed' — use PATCH /tasks/:id/complete para isso.
 */
router.patch('/:id', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { id: taskId } = req.params;

    if (!taskId) {
      throw new AppError('ID da tarefa é obrigatório.', 400);
    }

    const body = updateTaskSchema.parse(req.body);

    const task = await updateTask(taskId, user.id, {
      title:            body.title,
      description:      body.description,
      difficulty:       body.difficulty,
      priority:         body.priority,
      estimatedMinutes: body.estimatedMinutes,
      status:           body.status,
      dueDate:          body.dueDate,
    });

    return res.status(200).json({ tarefa: task });
  } catch (err) {
    return sendError(res, err, '[tarefas/PATCH]');
  }
});

// ---------------------------------------------------------------------------
// DELETE /tasks/:id
// ---------------------------------------------------------------------------

/**
 * Remove permanentemente uma tarefa do usuário autenticado.
 */
router.delete('/:id', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { id: taskId } = req.params;

    if (!taskId) {
      throw new AppError('ID da tarefa é obrigatório.', 400);
    }

    await deleteTask(taskId, user.id);

    return res.status(200).json({ mensagem: 'Tarefa excluída com sucesso.' });
  } catch (err) {
    return sendError(res, err, '[tarefas/DELETE]');
  }
});

// ---------------------------------------------------------------------------
// PATCH /tasks/:id/complete
// ---------------------------------------------------------------------------

/**
 * Marca uma tarefa como concluída e dispara o pipeline de gamificação completo.
 *
 * Retorna:
 * - A tarefa atualizada
 * - Pontos ganhos (com bônus de pontualidade ou penalidade de atraso)
 * - Novo valor do streak
 * - Se o usuário subiu de nível (e o novo nível)
 * - Marco de streak atingido (ex: 7 dias)
 * - Conquistas desbloqueadas nesta ação
 */
router.patch('/:id/complete', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { id: taskId } = req.params;

    if (!taskId) {
      throw new AppError('ID da tarefa é obrigatório.', 400);
    }

    const result = await completeTask(taskId, user.id);

    return res.status(200).json({
      tarefa:            result.task,
      pontosGanhos:      result.pointsEarned,
      novoStreak:        result.newStreak,
      subidoDeNivel:     result.leveledUp,
      novoNivel:         result.newLevel,
      marcoStreak:       result.milestoneReached,
      novasConquistas:   result.newAchievements,
      freezeUsado:       result.freezeUsed,
      recompensaNivel:   result.levelReward,
    });
  } catch (err) {
    return sendError(res, err, '[tarefas/complete]');
  }
});

export default router;
