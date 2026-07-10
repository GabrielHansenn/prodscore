import { Router } from 'express';
import { z } from 'zod';
import { MemberRole } from '@prodscore/shared';
import { authGuard, type AuthenticatedRequest } from '../middleware/auth.js';
import { sendError, AppError } from '../lib/errors.js';
import {
  createGroup,
  joinGroup,
  getUserGroups,
  getGroupDetails,
  getGroupMembers,
  getGroupRanking,
  updateGroup,
  regenerateInviteCode,
  updateMemberRole,
  removeMember,
  leaveGroup,
  deleteGroup,
} from '../services/group.service.js';
import { getMissionsForGroup, createGroupMission } from '../services/mission.service.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas de validação
// ---------------------------------------------------------------------------

const createGroupSchema = z.object({
  name: z
    .string({ required_error: 'Nome do grupo é obrigatório.' })
    .min(1,   { message: 'Nome do grupo é obrigatório.' })
    .max(100, { message: 'O nome deve ter no máximo 100 caracteres.' }),

  description: z
    .string()
    .max(500, { message: 'A descrição deve ter no máximo 500 caracteres.' })
    .optional(),

  imageUrl: z
    .string()
    .url({ message: 'URL da imagem inválida.' })
    .optional(),
});

const createGroupMissionSchema = z.object({
  title: z
    .string({ required_error: 'Título é obrigatório.' })
    .min(1,   { message: 'Título é obrigatório.' })
    .max(255, { message: 'O título deve ter no máximo 255 caracteres.' }),

  description: z
    .string()
    .max(1000, { message: 'A descrição deve ter no máximo 1000 caracteres.' })
    .default(''),

  targetValue: z
    .number({ required_error: 'Meta é obrigatória.', invalid_type_error: 'Meta deve ser um número.' })
    .int({ message: 'Meta deve ser um número inteiro.' })
    .min(1,     { message: 'Meta mínima é 1.' })
    .max(10000, { message: 'Meta máxima é 10.000.' }),

  rewardPoints: z
    .number({ invalid_type_error: 'Recompensa deve ser um número.' })
    .int({ message: 'Recompensa deve ser um número inteiro.' })
    .min(0, { message: 'Recompensa não pode ser negativa.' })
    .max(100000)
    .default(0),

  expiresAt: z
    .string()
    .datetime({ message: 'Data de expiração inválida. Use o formato ISO 8601.' })
    .refine(
      (d) => new Date(d) > new Date(),
      { message: 'A data de expiração deve ser no futuro.' },
    )
    .optional(),
});

const joinGroupSchema = z.object({
  invite_code: z
    .string({ required_error: 'Código de convite é obrigatório.' })
    .min(1, { message: 'Código de convite é obrigatório.' })
    .max(10, { message: 'Código de convite inválido.' }),
});

const updateGroupSchema = z.object({
  name: z
    .string()
    .min(1,   { message: 'Nome do grupo é obrigatório.' })
    .max(100, { message: 'O nome deve ter no máximo 100 caracteres.' })
    .optional(),

  description: z
    .string()
    .max(500, { message: 'A descrição deve ter no máximo 500 caracteres.' })
    .nullable()
    .optional(),

  imageUrl: z
    .string()
    .url({ message: 'URL da imagem inválida.' })
    .nullable()
    .optional(),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member'], {
    required_error: 'Papel é obrigatório.',
    invalid_type_error: 'Papel deve ser "admin" ou "member".',
  }),
});

// ---------------------------------------------------------------------------
// GET /groups
// ---------------------------------------------------------------------------

/**
 * Retorna todos os grupos do usuário autenticado com papel e contagem de membros.
 */
router.get('/', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const groups = await getUserGroups(user.id);
    return res.status(200).json({ grupos: groups, total: groups.length });
  } catch (err) {
    return sendError(res, err, '[grupos/GET]');
  }
});

// ---------------------------------------------------------------------------
// POST /groups
// ---------------------------------------------------------------------------

/**
 * Cria um novo grupo e define o criador como owner.
 * Gera um código de convite único de 6 caracteres.
 */
router.post('/', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const body = createGroupSchema.parse(req.body);

    const group = await createGroup({
      name:        body.name,
      description: body.description,
      imageUrl:    body.imageUrl,
      ownerId:     user.id,
    });

    return res.status(201).json({ grupo: group });
  } catch (err) {
    return sendError(res, err, '[grupos/POST]');
  }
});

// ---------------------------------------------------------------------------
// POST /groups/join
// ---------------------------------------------------------------------------

/**
 * Adiciona o usuário a um grupo via código de convite.
 * Deve estar antes de /:id para não conflitar com a rota dinâmica.
 */
router.post('/join', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const body = joinGroupSchema.parse(req.body);

    const { group, membership } = await joinGroup(user.id, body.invite_code);

    return res.status(200).json({
      mensagem: `Você entrou no grupo "${group.name}" com sucesso.`,
      grupo:    group,
      membro:   membership,
    });
  } catch (err) {
    return sendError(res, err, '[grupos/join]');
  }
});

// ---------------------------------------------------------------------------
// GET /groups/:id
// ---------------------------------------------------------------------------

/**
 * Retorna detalhes completos do grupo incluindo contagem de membros e missões ativas.
 * Restrito a membros do grupo.
 */
router.get('/:id', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const groupId = req.params['id'];

    if (!groupId) throw new AppError('ID do grupo é obrigatório.', 400);

    const details = await getGroupDetails(groupId, user.id);
    return res.status(200).json({ grupo: details });
  } catch (err) {
    return sendError(res, err, '[grupos/GET/:id]');
  }
});

// ---------------------------------------------------------------------------
// GET /groups/:id/members
// ---------------------------------------------------------------------------

/**
 * Lista os membros do grupo com nível, pontos e streak.
 * Restrito a membros do grupo.
 */
router.get('/:id/members', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const groupId = req.params['id'];

    if (!groupId) throw new AppError('ID do grupo é obrigatório.', 400);

    const members = await getGroupMembers(groupId, user.id);
    return res.status(200).json({ membros: members, total: members.length });
  } catch (err) {
    return sendError(res, err, '[grupos/GET/:id/members]');
  }
});

// ---------------------------------------------------------------------------
// GET /groups/:id/ranking
// ---------------------------------------------------------------------------

/**
 * Retorna o ranking do grupo com score multi-fator.
 * Score = total_points × 0.5 + (streak × 10) × 0.3 + consistency_rate × 0.2
 */
router.get('/:id/ranking', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const groupId = req.params['id'];

    if (!groupId) throw new AppError('ID do grupo é obrigatório.', 400);

    const ranking = await getGroupRanking(groupId, user.id);
    return res.status(200).json({ ranking, total: ranking.length });
  } catch (err) {
    return sendError(res, err, '[grupos/GET/:id/ranking]');
  }
});

// ---------------------------------------------------------------------------
// GET /groups/:id/missions
// ---------------------------------------------------------------------------

/**
 * Lista as missões ativas do grupo com o progresso do usuário.
 * Restrito a membros do grupo.
 */
router.get('/:id/missions', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const groupId = req.params['id'];

    if (!groupId) throw new AppError('ID do grupo é obrigatório.', 400);

    const missions = await getMissionsForGroup(groupId, user.id);
    return res.status(200).json({ missoes: missions, total: missions.length });
  } catch (err) {
    return sendError(res, err, '[grupos/GET/:id/missions]');
  }
});

// ---------------------------------------------------------------------------
// POST /groups/:id/missions
// ---------------------------------------------------------------------------

/**
 * Cria uma missão coletiva para o grupo.
 * Restrito a owner e admin do grupo.
 */
router.post('/:id/missions', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const groupId = req.params['id'];

    if (!groupId) throw new AppError('ID do grupo é obrigatório.', 400);

    const body = createGroupMissionSchema.parse(req.body);

    const mission = await createGroupMission(
      {
        groupId,
        title:        body.title,
        description:  body.description,
        targetValue:  body.targetValue,
        rewardPoints: body.rewardPoints,
        expiresAt:    body.expiresAt,
      },
      user.id,
    );

    return res.status(201).json({ missao: mission });
  } catch (err) {
    return sendError(res, err, '[grupos/POST/:id/missions]');
  }
});

// ---------------------------------------------------------------------------
// PATCH /groups/:id — editar informações do grupo
// ---------------------------------------------------------------------------

/**
 * Atualiza nome, descrição ou imagem do grupo.
 * Restrito a owner e admin.
 */
router.patch('/:id', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const groupId = req.params['id'];

    if (!groupId) throw new AppError('ID do grupo é obrigatório.', 400);

    const body = updateGroupSchema.parse(req.body);
    const input: { name?: string; description?: string | null; imageUrl?: string | null } = {};
    if (body.name        !== undefined) input.name        = body.name;
    if (body.description !== undefined) input.description = body.description;
    if (body.imageUrl    !== undefined) input.imageUrl    = body.imageUrl;
    const updated = await updateGroup(groupId, user.id, input);
    return res.status(200).json({ grupo: updated });
  } catch (err) {
    return sendError(res, err, '[grupos/PATCH/:id]');
  }
});

// ---------------------------------------------------------------------------
// POST /groups/:id/regenerate-invite — novo código de convite
// ---------------------------------------------------------------------------

/**
 * Gera um novo código de convite único para o grupo.
 * Restrito a owner e admin.
 */
router.post('/:id/regenerate-invite', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const groupId = req.params['id'];

    if (!groupId) throw new AppError('ID do grupo é obrigatório.', 400);

    const newCode = await regenerateInviteCode(groupId, user.id);
    return res.status(200).json({ inviteCode: newCode });
  } catch (err) {
    return sendError(res, err, '[grupos/POST/:id/regenerate-invite]');
  }
});

// ---------------------------------------------------------------------------
// PATCH /groups/:id/members/:userId — alterar papel de membro
// ---------------------------------------------------------------------------

/**
 * Altera o papel de um membro (admin ↔ member).
 * Restrito ao owner do grupo.
 */
router.patch('/:id/members/:userId', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { id: groupId, userId: targetUserId } = req.params as { id: string; userId: string };

    if (!groupId || !targetUserId) throw new AppError('IDs obrigatórios.', 400);

    const { role } = updateMemberRoleSchema.parse(req.body);
    const newRole  = role === 'admin' ? MemberRole.Admin : MemberRole.Member;
    await updateMemberRole(groupId, targetUserId, newRole, user.id);
    return res.status(200).json({ mensagem: 'Papel atualizado com sucesso.' });
  } catch (err) {
    return sendError(res, err, '[grupos/PATCH/:id/members/:userId]');
  }
});

// ---------------------------------------------------------------------------
// DELETE /groups/:id/members/:userId — remover membro (kick)
// ---------------------------------------------------------------------------

/**
 * Remove um membro do grupo.
 * Owner pode remover qualquer membro; admin pode remover apenas membros comuns.
 */
router.delete('/:id/members/:userId', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { id: groupId, userId: targetUserId } = req.params as { id: string; userId: string };

    if (!groupId || !targetUserId) throw new AppError('IDs obrigatórios.', 400);

    await removeMember(groupId, targetUserId, user.id);
    return res.status(200).json({ mensagem: 'Membro removido com sucesso.' });
  } catch (err) {
    return sendError(res, err, '[grupos/DELETE/:id/members/:userId]');
  }
});

// ---------------------------------------------------------------------------
// POST /groups/:id/leave — sair do grupo
// ---------------------------------------------------------------------------

/**
 * Remove o próprio usuário do grupo.
 * Owner não pode sair — deve excluir o grupo.
 */
router.post('/:id/leave', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const groupId = req.params['id'];

    if (!groupId) throw new AppError('ID do grupo é obrigatório.', 400);

    await leaveGroup(groupId, user.id);
    return res.status(200).json({ mensagem: 'Você saiu do grupo com sucesso.' });
  } catch (err) {
    return sendError(res, err, '[grupos/POST/:id/leave]');
  }
});

// ---------------------------------------------------------------------------
// DELETE /groups/:id — excluir grupo
// ---------------------------------------------------------------------------

/**
 * Exclui permanentemente o grupo.
 * Restrito ao owner.
 */
router.delete('/:id', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const groupId = req.params['id'];

    if (!groupId) throw new AppError('ID do grupo é obrigatório.', 400);

    await deleteGroup(groupId, user.id);
    return res.status(200).json({ mensagem: 'Grupo excluído com sucesso.' });
  } catch (err) {
    return sendError(res, err, '[grupos/DELETE/:id]');
  }
});

export default router;
