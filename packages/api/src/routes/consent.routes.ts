import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { sendError, AppError } from '../lib/errors.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schema de validação
// ---------------------------------------------------------------------------

const consentSchema = z.object({
  consent: z.object(
    {
      essential:  z.boolean({ required_error: 'A categoria "essential" é obrigatória.' }),
      analytics:  z.boolean({ required_error: 'A categoria "analytics" é obrigatória.' }),
      functional: z.boolean({ required_error: 'A categoria "functional" é obrigatória.' }),
      marketing:  z.boolean({ required_error: 'A categoria "marketing" é obrigatória.' }),
    },
    { required_error: 'O consentimento por categoria é obrigatório.' },
  ),

  version: z
    .string({ required_error: 'A versão da política é obrigatória.' })
    .min(1,  { message: 'A versão da política é obrigatória.' })
    .max(20, { message: 'Versão da política inválida.' }),
});

/**
 * Extrai o ID do usuário a partir do Bearer token, se houver.
 * Consentimento não exige login — o registro é gravado com user_id nulo
 * quando o visitante ainda não está autenticado.
 */
async function tryGetUserId(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// ---------------------------------------------------------------------------
// POST /consent
// ---------------------------------------------------------------------------

/**
 * Registra o consentimento de cookies para fins de prestação de contas (LGPD).
 *
 * Rota pública (sem authGuard) — o consentimento pode ser dado por um
 * visitante antes de criar conta ou fazer login.
 */
router.post('/', async (req, res) => {
  try {
    const body   = consentSchema.parse(req.body);
    const userId = await tryGetUserId(req.headers['authorization']);

    const { error } = await supabase.from('consent_records').insert({
      user_id:    userId,
      consent:    body.consent,
      version:    body.version,
      ip_address: req.ip ?? null,
      user_agent: req.headers['user-agent'] ?? null,
    });

    if (error) {
      throw new AppError('Erro ao registrar consentimento.', 500, 'REGISTRO_CONSENTIMENTO_FALHOU');
    }

    return res.status(201).json({ mensagem: 'Consentimento registrado com sucesso.' });
  } catch (err) {
    return sendError(res, err, '[consent/POST]');
  }
});

export default router;
