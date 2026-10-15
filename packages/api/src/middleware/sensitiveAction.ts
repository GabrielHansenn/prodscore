import type { Request, Response, NextFunction } from 'express';
import { supabase, createEphemeralAuthClient } from '../lib/supabase.js';
import { decodeJwtPayload } from './aal.js';
import type { AuthenticatedRequest } from './auth.js';

/** Códigos de erro que o front usa para marcar o campo "Senha atual" */
export const SENSITIVE_ERROR_CODES = {
  passwordRequired: 'SENHA_ATUAL_OBRIGATORIA',
  passwordWrong:    'SENHA_ATUAL_INCORRETA',
  aal2Required:     'AAL2_REQUERIDO',
} as const;

/**
 * Confirmação de ações sensíveis (trocar senha, excluir conta).
 *
 * Regra:
 * 1. Todo mundo confirma com a SENHA ATUAL (`currentPassword` no corpo).
 * 2. Quem tem 2FA ativo precisa, além disso, de uma sessão verificada com o
 *    código (aal2) — como já era.
 *
 * Antes, as duas ações exigiam aal2 de todos: quem não usava 2FA era obrigado
 * a instalar um aplicativo autenticador só para trocar a senha ou excluir a
 * conta (direito garantido pela LGPD).
 *
 * Erros usam 400/403, nunca 401: o 401 faz o web encerrar a sessão.
 * Deve vir depois do authGuard.
 */
export async function requireSensitiveAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user } = req as AuthenticatedRequest;
    const currentPassword = (req.body as { currentPassword?: unknown } | undefined)?.currentPassword;

    if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
      res.status(400).json({ erro: 'Digite sua senha atual para confirmar.', codigo: SENSITIVE_ERROR_CODES.passwordRequired });
      return;
    }

    // Confere a senha com um login descartável (não altera a sessão do usuário)
    const { error: passwordError } = await createEphemeralAuthClient().auth.signInWithPassword({
      email:    user.email,
      password: currentPassword,
    });

    if (passwordError) {
      if (passwordError.status === 429) {
        res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', codigo: 'MUITAS_TENTATIVAS' });
        return;
      }
      res.status(400).json({ erro: 'Senha atual incorreta.', codigo: SENSITIVE_ERROR_CODES.passwordWrong });
      return;
    }

    // Sessão já verificada com o código: nada mais a checar
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (decodeJwtPayload(token)?.['aal'] === 'aal2') {
      next();
      return;
    }

    // Sessão sem código: só passa se a conta não tiver 2FA ativo
    const { data: factorsData, error: factorsError } = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
    if (factorsError) {
      console.error('[requireSensitiveAuth] Erro ao listar fatores:', factorsError.message);
      res.status(500).json({ erro: 'Não foi possível confirmar sua identidade. Tente novamente.' });
      return;
    }

    const hasActive2fa = (factorsData?.factors ?? []).some((f) => f.status === 'verified');
    if (hasActive2fa) {
      res.status(403).json({
        erro: 'Sua conta tem verificação em duas etapas. Entre novamente com o código do aplicativo autenticador para continuar.',
        codigo: SENSITIVE_ERROR_CODES.aal2Required,
      });
      return;
    }

    next();
  } catch (err) {
    console.error('[requireSensitiveAuth] Erro inesperado:', err);
    res.status(500).json({ erro: 'Erro interno ao confirmar a ação.' });
  }
}
