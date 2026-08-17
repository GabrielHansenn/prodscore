import type { Request, Response, NextFunction } from 'express';

/**
 * Decodifica o payload de um JWT sem verificar a assinatura.
 *
 * Seguro aqui porque este middleware é sempre aplicado DEPOIS de `authGuard`
 * na cadeia (ver rotas), que já validou a assinatura e a expiração do token
 * junto ao Supabase Auth via `verifySupabaseToken`.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payloadJson = Buffer.from(parts[1] as string, 'base64url').toString('utf-8');
    return JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Middleware que exige nível de garantia aal2 (segundo fator TOTP verificado)
 * na sessão para liberar o acesso à rota.
 *
 * Deve ser aplicado sempre APÓS `authGuard` — depende do cabeçalho
 * Authorization já ter sido validado como um JWT autêntico do Supabase.
 *
 * Retorna 403 quando a claim `aal` do token não é 'aal2'.
 */
export function requireAAL2(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const payload = token ? decodeJwtPayload(token) : null;
  const aal = payload?.['aal'];

  if (aal !== 'aal2') {
    res.status(403).json({
      erro: 'Esta ação exige verificação em duas etapas (2FA). Confirme o código do seu aplicativo autenticador e tente novamente.',
      codigo: 'AAL2_REQUERIDO',
    });
    return;
  }

  next();
}
