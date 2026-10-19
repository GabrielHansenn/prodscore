/**
 * GET /achievements/level-rewards — recompensas de nível lidas do banco,
 * usadas pela página de Ajuda (que não pode ter esses valores escritos à mão).
 */

jest.mock('../lib/supabase', () => ({
  supabase:            { from: jest.fn() },
  verifySupabaseToken: jest.fn(),
}));

import express from 'express';
import request from 'supertest';
import achievementRoutes from '../routes/achievements.routes';
import { supabase, verifySupabaseToken } from '../lib/supabase';

const mockFrom        = supabase.from as jest.Mock;
const mockVerifyToken = verifySupabaseToken as jest.Mock;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/achievements', achievementRoutes);
  return app;
}

/** Simula supabase.from('level_rewards').select(...).order(...) */
function mockQuery(result: { data: unknown; error: unknown }) {
  const order  = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ order });
  mockFrom.mockReturnValue({ select });
  return { select, order };
}

describe('GET /achievements/level-rewards', () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ user: { id: 'user-1' }, error: null });
  });

  it('exige login', async () => {
    const res = await request(app).get('/achievements/level-rewards');
    expect(res.status).toBe(401);
  });

  it('devolve as recompensas do banco, em ordem de nível, no formato da API', async () => {
    const { order } = mockQuery({
      data: [
        { level: 5,  bonus_points: 50,  bonus_freezes: 1, badge_key: 'rocket', description: 'Foguete' },
        { level: 10, bonus_points: 100, bonus_freezes: 2, badge_key: null,     description: 'Estrela' },
      ],
      error: null,
    });

    const res = await request(app)
      .get('/achievements/level-rewards')
      .set('Authorization', 'Bearer token-valido');

    expect(res.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith('level_rewards');
    expect(order).toHaveBeenCalledWith('level', { ascending: true });
    expect(res.body.total).toBe(2);
    expect(res.body.recompensas[0]).toEqual({
      level: 5, bonusPoints: 50, bonusFreezes: 1, badgeKey: 'rocket', description: 'Foguete',
    });
  });

  it('erro no banco vira 500 com mensagem amigável', async () => {
    mockQuery({ data: null, error: { message: 'falhou' } });

    const res = await request(app)
      .get('/achievements/level-rewards')
      .set('Authorization', 'Bearer token-valido');

    expect(res.status).toBe(500);
    expect(res.body.erro).toBe('Erro ao buscar as recompensas de nível.');
  });
});
