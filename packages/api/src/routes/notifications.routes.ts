import { Router } from 'express';
import { authGuard, type AuthenticatedRequest } from '../middleware/auth.js';
import { sendError, AppError } from '../lib/errors.js';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  clearAll,
} from '../services/notification.service.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /notifications — lista paginada (mais recentes primeiro)
// ---------------------------------------------------------------------------
router.get('/', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const before = typeof req.query['before'] === 'string' ? req.query['before'] : undefined;
    const { notifications, hasMore } = await listNotifications(user.id, before);
    return res.status(200).json({ notificacoes: notifications, temMais: hasMore });
  } catch (err) {
    return sendError(res, err, '[notificacoes/GET]');
  }
});

// ---------------------------------------------------------------------------
// GET /notifications/unread-count — badge do sino
// ---------------------------------------------------------------------------
router.get('/unread-count', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const naoLidas = await getUnreadCount(user.id);
    return res.status(200).json({ naoLidas });
  } catch (err) {
    return sendError(res, err, '[notificacoes/GET/unread-count]');
  }
});

// ---------------------------------------------------------------------------
// POST /notifications/read-all — marca todas como lidas
// ---------------------------------------------------------------------------
router.post('/read-all', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const marcadas = await markAllAsRead(user.id);
    return res.status(200).json({ marcadas });
  } catch (err) {
    return sendError(res, err, '[notificacoes/POST/read-all]');
  }
});

// ---------------------------------------------------------------------------
// POST /notifications/:id/read — marca uma como lida
// ---------------------------------------------------------------------------
router.post('/:id/read', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const id = req.params['id'];
    if (!id) throw new AppError('ID da notificação é obrigatório.', 400);
    await markAsRead(user.id, id);
    return res.status(200).json({ mensagem: 'Notificação marcada como lida.' });
  } catch (err) {
    return sendError(res, err, '[notificacoes/POST/read]');
  }
});

// ---------------------------------------------------------------------------
// DELETE /notifications — limpa o histórico do usuário
// ---------------------------------------------------------------------------
router.delete('/', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    await clearAll(user.id);
    return res.status(200).json({ mensagem: 'Notificações removidas.' });
  } catch (err) {
    return sendError(res, err, '[notificacoes/DELETE]');
  }
});

export default router;
