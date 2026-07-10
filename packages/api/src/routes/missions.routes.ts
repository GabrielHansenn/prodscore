import { Router } from 'express';
import { authGuard, type AuthenticatedRequest } from '../middleware/auth.js';
import { sendError, AppError } from '../lib/errors.js';
import {
  getMissionsForUser,
  getMissionById,
  joinMission,
} from '../services/mission.service.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /missions
// ---------------------------------------------------------------------------

/**
 * Retorna todas as missões disponíveis para o usuário com seu progresso.
 *
 * Inclui:
 * - Missões individuais ativas (globais, para todos)
 * - Missões dos grupos dos quais o usuário é membro
 * - Indicador de se o usuário está participando e seu progresso
 */
router.get('/', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const missions = await getMissionsForUser(user.id);
    return res.status(200).json({ missoes: missions, total: missions.length });
  } catch (err) {
    return sendError(res, err, '[missoes/GET]');
  }
});

// ---------------------------------------------------------------------------
// GET /missions/:id
// ---------------------------------------------------------------------------

/**
 * Retorna os detalhes completos de uma missão com o progresso do usuário.
 * Para missões de grupo, inclui o placar de todos os participantes.
 */
router.get('/:id', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const missionId = req.params['id'];

    if (!missionId) throw new AppError('ID da missão é obrigatório.', 400);

    const mission = await getMissionById(missionId, user.id);
    return res.status(200).json({ missao: mission });
  } catch (err) {
    return sendError(res, err, '[missoes/GET/:id]');
  }
});

// ---------------------------------------------------------------------------
// POST /missions/:id/join
// ---------------------------------------------------------------------------

/**
 * Registra a participação do usuário em uma missão individual.
 * Missões de grupo têm entrada automática via checkMissionProgress.
 */
router.post('/:id/join', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const missionId = req.params['id'];

    if (!missionId) throw new AppError('ID da missão é obrigatório.', 400);

    const { mission, joinedAt } = await joinMission(missionId, user.id);

    return res.status(200).json({
      mensagem: `Você entrou na missão "${mission.title}".`,
      missao:   mission,
      entradaEm: joinedAt,
    });
  } catch (err) {
    return sendError(res, err, '[missoes/join]');
  }
});

export default router;
