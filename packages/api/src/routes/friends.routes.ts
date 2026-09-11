import { Router } from 'express';
import { z } from 'zod';
import { authGuard, type AuthenticatedRequest } from '../middleware/auth.js';
import { sendError, AppError } from '../lib/errors.js';
import {
  listFriends,
  listFriendRequests,
  sendFriendRequest,
  respondFriendRequest,
  removeFriendship,
} from '../services/friend.service.js';
import {
  listMessages,
  sendMessage,
  markConversationRead,
  getUnreadCounts,
} from '../services/message.service.js';

const router = Router();

const sendRequestSchema = z.object({
  addresseeId: z.string().uuid({ message: 'ID do usuário inválido.' }),
});

const directionSchema = z.enum(['received', 'sent']).default('received');

const sendMessageSchema = z.object({
  content: z.string({ required_error: 'Conteúdo é obrigatório.' }),
});

// ---------------------------------------------------------------------------
// GET /friends/unread — não lidas por remetente (deve ficar ANTES de /:userId)
// ---------------------------------------------------------------------------
router.get('/unread', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const naoLidas = await getUnreadCounts(user.id);
    return res.status(200).json({ naoLidas });
  } catch (err) {
    return sendError(res, err, '[amigos/GET/unread]');
  }
});

// ---------------------------------------------------------------------------
// GET /friends — lista de amigos (amizades aceitas)
// ---------------------------------------------------------------------------
router.get('/', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const amigos = await listFriends(user.id);
    return res.status(200).json({ amigos, total: amigos.length });
  } catch (err) {
    return sendError(res, err, '[amigos/GET]');
  }
});

// ---------------------------------------------------------------------------
// GET /friends/requests?direction=received|sent — pedidos pendentes
// ---------------------------------------------------------------------------
router.get('/requests', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const direction = directionSchema.parse(req.query['direction']);
    const pedidos = await listFriendRequests(user.id, direction);
    return res.status(200).json({ pedidos, total: pedidos.length });
  } catch (err) {
    return sendError(res, err, '[amigos/GET/requests]');
  }
});

// ---------------------------------------------------------------------------
// POST /friends/requests — envia pedido de amizade
// ---------------------------------------------------------------------------
router.post('/requests', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const { addresseeId } = sendRequestSchema.parse(req.body);
    const pedido = await sendFriendRequest(user.id, addresseeId);
    return res.status(201).json({ mensagem: 'Pedido de amizade enviado.', pedido });
  } catch (err) {
    return sendError(res, err, '[amigos/POST/requests]');
  }
});

// ---------------------------------------------------------------------------
// POST /friends/requests/:id/accept | /decline — responde pedido recebido
// ---------------------------------------------------------------------------
router.post('/requests/:id/accept', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const id = req.params['id'];
    if (!id) throw new AppError('ID do pedido é obrigatório.', 400);
    const pedido = await respondFriendRequest(id, user.id, true);
    return res.status(200).json({ mensagem: 'Pedido aceito. Vocês agora são amigos!', pedido });
  } catch (err) {
    return sendError(res, err, '[amigos/POST/requests/accept]');
  }
});

router.post('/requests/:id/decline', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const id = req.params['id'];
    if (!id) throw new AppError('ID do pedido é obrigatório.', 400);
    const pedido = await respondFriendRequest(id, user.id, false);
    return res.status(200).json({ mensagem: 'Pedido recusado.', pedido });
  } catch (err) {
    return sendError(res, err, '[amigos/POST/requests/decline]');
  }
});

// ---------------------------------------------------------------------------
// Chat — /friends/:userId/messages (só entre amigos; a checagem é do service)
// ---------------------------------------------------------------------------

/** Histórico da conversa (mais antigas → mais novas). `?before=<ISO>` pagina para trás. */
router.get('/:userId/messages', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const friendId = req.params['userId'];
    if (!friendId) throw new AppError('ID do usuário é obrigatório.', 400);
    const before = typeof req.query['before'] === 'string' ? req.query['before'] : undefined;
    const { messages, hasMore } = await listMessages(user.id, friendId, before);
    return res.status(200).json({ mensagens: messages, temMais: hasMore });
  } catch (err) {
    return sendError(res, err, '[amigos/GET/messages]');
  }
});

/** Envia uma mensagem. O destinatário recebe via Realtime (INSERT em messages). */
router.post('/:userId/messages', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const friendId = req.params['userId'];
    if (!friendId) throw new AppError('ID do usuário é obrigatório.', 400);
    const { content } = sendMessageSchema.parse(req.body);
    const mensagem = await sendMessage(user.id, friendId, content);
    return res.status(201).json({ mensagem });
  } catch (err) {
    return sendError(res, err, '[amigos/POST/messages]');
  }
});

/** Marca como lidas todas as mensagens recebidas desse amigo. */
router.post('/:userId/messages/read', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const friendId = req.params['userId'];
    if (!friendId) throw new AppError('ID do usuário é obrigatório.', 400);
    const marcadas = await markConversationRead(user.id, friendId);
    return res.status(200).json({ marcadas });
  } catch (err) {
    return sendError(res, err, '[amigos/POST/messages/read]');
  }
});

// ---------------------------------------------------------------------------
// DELETE /friends/:userId — remove amizade ou cancela pedido enviado
// ---------------------------------------------------------------------------
router.delete('/:userId', authGuard, async (req, res) => {
  try {
    const { user } = req as AuthenticatedRequest;
    const otherId = req.params['userId'];
    if (!otherId) throw new AppError('ID do usuário é obrigatório.', 400);
    await removeFriendship(user.id, otherId);
    return res.status(200).json({ mensagem: 'Vínculo removido.' });
  } catch (err) {
    return sendError(res, err, '[amigos/DELETE]');
  }
});

export default router;
