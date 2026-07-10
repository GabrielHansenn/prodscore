import type { Request, Response, NextFunction } from 'express';
import { verifySupabaseToken } from '../lib/supabase.js';
import type { User } from '@prodscore/shared';

/**
 * Extensão do tipo Request para expor o usuário autenticado nas rotas protegidas.
 * Acesse via `(req as AuthenticatedRequest).user` dentro dos handlers.
 */
export interface AuthenticatedRequest extends Request {
  /** Perfil completo do usuário autenticado, injetado pelo authGuard */
  user: User;
}

/**
 * Middleware de autenticação JWT para rotas protegidas.
 *
 * Fluxo:
 * 1. Extrai o Bearer token do cabeçalho Authorization
 * 2. Valida a assinatura e expiração via Supabase Auth
 * 3. Busca o perfil completo do usuário em public.profiles
 * 4. Injeta `req.user` com os dados do usuário para uso no handler
 *
 * Retorna 401 se o token estiver ausente, malformado ou expirado.
 */
export async function authGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        erro: 'Token de autenticação ausente. Envie o cabeçalho: Authorization: Bearer <token>',
      });
      return;
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      res.status(401).json({ erro: 'Token de autenticação vazio.' });
      return;
    }

    const { user, error } = await verifySupabaseToken(token);

    if (error || !user) {
      res.status(401).json({ erro: error ?? 'Não autorizado.' });
      return;
    }

    (req as AuthenticatedRequest).user = user;
    next();
  } catch (err) {
    console.error('[authGuard] Erro inesperado na verificação de token:', err);
    res.status(500).json({ erro: 'Erro interno na autenticação.' });
  }
}
