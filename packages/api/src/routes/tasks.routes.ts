import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { TaskDifficulty, TaskPriority, TaskStatus, MAX_PROOF_FILE_SIZE_BYTES } from '@prodscore/shared';
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
import {
  uploadTaskProof,
  getTaskProofSignedUrl,
  deleteTaskProof,
} from '../services/proof.service.js';

const router = Router();

/** Upload em memória (o arquivo é validado e enviado ao Storage sem tocar o disco) */
const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_FILE_SIZE_BYTES },
});

/**
 * Middleware do multer com tratamento de erro em PT-BR.
 * Erros do multer (ex: arquivo grande demais) acontecem antes do handler da
 * rota rodar, então não são pegos pelo try/catch normal — precisam de
 * tratamento próprio aqui.
 */
function handleProofUpload(req: Request, res: Response, next: NextFunction): void {
  proofUpload.single('proof')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ erro: 'A imagem deve ter no máximo 5 MB.', codigo: 'ARQUIVO_MUITO_GRANDE' });
      return;
    }
    if (err) {
      res.status(400).json({ erro: 'Erro ao processar o arquivo enviado.', codigo: 'UPLOAD_INVALIDO' });
      return;
    }
    next();
  });
}

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

  requiresProof: z
    .boolean({ invalid_type_error: 'requiresProof deve ser verdadeiro ou falso.' })
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

    requiresProof: z
      .boolean({ invalid_type_error: 'requiresProof deve ser verdadeiro ou falso.' })
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
      requiresProof:     body.requiresProof,
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
      requiresProof:    body.requiresProof,
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

// ---------------------------------------------------------------------------
// POST /tasks/:id/proof
// ---------------------------------------------------------------------------

/**
 * Anexa (ou substitui) a foto de comprovação de conclusão de uma tarefa.
 *
 * Campo multipart esperado: "proof" (arquivo único). O tipo real é
 * detectado pelos bytes do arquivo no servidor — o Content-Type enviado
 * pelo cliente nunca é usado para essa decisão.
 */
router.post('/:id/proof', authGuard, handleProofUpload, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { id: taskId } = req.params;

    if (!taskId) {
      throw new AppError('ID da tarefa é obrigatório.', 400);
    }
    if (!req.file) {
      throw new AppError('Nenhum arquivo enviado. Envie a foto no campo "proof".', 400, 'ARQUIVO_AUSENTE');
    }

    const proof = await uploadTaskProof(taskId, user.id, req.file.buffer);

    return res.status(201).json({
      mensagem: 'Comprovação anexada com sucesso.',
      prova:    proof,
    });
  } catch (err) {
    return sendError(res, err, '[tarefas/proof/POST]');
  }
});

// ---------------------------------------------------------------------------
// GET /tasks/:id/proof
// ---------------------------------------------------------------------------

/**
 * Retorna uma signed URL temporária para exibir a comprovação de uma tarefa.
 * Acessível pelo dono da tarefa e por membros do grupo ao qual ela pertence.
 */
router.get('/:id/proof', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { id: taskId } = req.params;

    if (!taskId) {
      throw new AppError('ID da tarefa é obrigatório.', 400);
    }

    const url = await getTaskProofSignedUrl(taskId, user.id);

    return res.status(200).json({ url });
  } catch (err) {
    return sendError(res, err, '[tarefas/proof/GET]');
  }
});

// ---------------------------------------------------------------------------
// DELETE /tasks/:id/proof
// ---------------------------------------------------------------------------

/**
 * Remove a comprovação de uma tarefa — apaga o arquivo do Storage e o
 * registro no banco.
 */
router.delete('/:id/proof', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { id: taskId } = req.params;

    if (!taskId) {
      throw new AppError('ID da tarefa é obrigatório.', 400);
    }

    await deleteTaskProof(taskId, user.id);

    return res.status(200).json({ mensagem: 'Comprovação removida com sucesso.' });
  } catch (err) {
    return sendError(res, err, '[tarefas/proof/DELETE]');
  }
});

export default router;
