/**
 * Testes unitários do serviço de gamificação.
 * Funções puras são testadas sem mock; funções com I/O mockam o cliente Supabase.
 */

// Mock do cliente Supabase — deve ser chamado antes de qualquer import dos serviços
jest.mock('../lib/supabase');

import { TaskDifficulty, TaskPriority } from '@prodscore/shared';
import { levelThreshold, applyLatePenalty } from '@prodscore/shared/constants';
import { calculatePoints, updateStreak, checkLevelUp } from '../services/gamification.service';
import { supabase } from '../lib/supabase';

// Alias tipado para facilitar a configuração dos mocks
const mockFrom = supabase.from as jest.Mock;
const mockRpc  = supabase.rpc  as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers para construir cadeias Supabase mockadas
// ---------------------------------------------------------------------------

/** Cria cadeia de mock para SELECT ... .eq().single() */
function mockSelectSingle(data: unknown, error: unknown = null) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

/** Cria cadeia de mock para UPDATE ... .eq() */
function mockUpdate(error: unknown = null) {
  return {
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error }),
    }),
  };
}

/** Cria cadeia de mock para INSERT ... .select().single() */
function mockInsertSingle(data: unknown, error: unknown = null) {
  return {
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

/** Cria cadeia de mock para SELECT ... .eq().maybeSingle() */
function mockSelectMaybeSingle(data: unknown, error: unknown = null) {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// calculatePoints — função pura, sem mock
// ---------------------------------------------------------------------------

describe('calculatePoints', () => {
  it('deve retornar 10 pontos para dificuldade fácil sem prazo (null)', () => {
    expect(calculatePoints(TaskDifficulty.Easy, null)).toBe(10);
  });

  it('deve retornar 12 pontos para dificuldade fácil no prazo (bônus 20%)', () => {
    // floor(10 * 1.20) = 12
    expect(calculatePoints(TaskDifficulty.Easy, true)).toBe(12);
  });

  it('deve aplicar penalidade de 30% por atraso na dificuldade fácil', () => {
    // floor(10 * 0.70) = 7
    expect(calculatePoints(TaskDifficulty.Easy, false)).toBe(7);
  });

  it('deve retornar 25 pontos para dificuldade média sem prazo', () => {
    expect(calculatePoints(TaskDifficulty.Medium, null)).toBe(25);
  });

  it('deve retornar 30 pontos para dificuldade média no prazo (bônus 20%)', () => {
    // floor(25 * 1.20) = 30
    expect(calculatePoints(TaskDifficulty.Medium, true)).toBe(30);
  });

  it('deve retornar 17 pontos para dificuldade média com atraso (−30%)', () => {
    // floor(25 * 0.70) = 17
    expect(calculatePoints(TaskDifficulty.Medium, false)).toBe(17);
  });

  it('deve retornar 60 pontos para dificuldade difícil no prazo', () => {
    // floor(50 * 1.20) = 60
    expect(calculatePoints(TaskDifficulty.Hard, true)).toBe(60);
  });

  it('deve retornar 120 pontos para dificuldade épica no prazo', () => {
    // floor(100 * 1.20) = 120
    expect(calculatePoints(TaskDifficulty.Epic, true)).toBe(120);
  });

  it('testa todas as 4 dificuldades base sem modificador', () => {
    expect(calculatePoints(TaskDifficulty.Easy,   null)).toBe(10);
    expect(calculatePoints(TaskDifficulty.Medium, null)).toBe(25);
    expect(calculatePoints(TaskDifficulty.Hard,   null)).toBe(50);
    expect(calculatePoints(TaskDifficulty.Epic,   null)).toBe(100);
  });

  it('prioridade medium (default) não altera a pontuação', () => {
    expect(calculatePoints(TaskDifficulty.Hard, true, TaskPriority.Medium)).toBe(60);
    expect(calculatePoints(TaskDifficulty.Hard, null, TaskPriority.Medium)).toBe(50);
  });

  it('prioridade low aplica 0.90× sobre o resultado final', () => {
    // Hard sem prazo: floor(50 * 1.0 * 0.90) = 45
    expect(calculatePoints(TaskDifficulty.Hard, null, TaskPriority.Low)).toBe(45);
    // Hard no prazo: floor(50 * 1.20 * 0.90) = floor(54) = 54
    expect(calculatePoints(TaskDifficulty.Hard, true, TaskPriority.Low)).toBe(54);
  });

  it('prioridade high aplica 1.10× sobre o resultado final', () => {
    // Medium sem prazo: floor(25 * 1.0 * 1.10) = 27
    expect(calculatePoints(TaskDifficulty.Medium, null, TaskPriority.High)).toBe(27);
    // Medium no prazo: floor(25 * 1.20 * 1.10) = floor(33) = 33
    expect(calculatePoints(TaskDifficulty.Medium, true, TaskPriority.High)).toBe(33);
  });

  it('prioridade urgent aplica 1.25× — Epic + urgent + pontual = 150 pts', () => {
    // Epic no prazo: floor(100 * 1.20 * 1.25) = floor(150) = 150
    expect(calculatePoints(TaskDifficulty.Epic, true, TaskPriority.Urgent)).toBe(150);
    // Epic com atraso: floor(100 * 0.70 * 1.25) = floor(87.5) = 87
    expect(calculatePoints(TaskDifficulty.Epic, false, TaskPriority.Urgent)).toBe(87);
  });
});

// ---------------------------------------------------------------------------
// levelThreshold — fórmula pura: nível² × 100
// ---------------------------------------------------------------------------

describe('levelThreshold', () => {
  it('deve seguir a fórmula nível² × 100', () => {
    expect(levelThreshold(1)).toBe(100);    // 1² × 100
    expect(levelThreshold(2)).toBe(400);    // 2² × 100
    expect(levelThreshold(3)).toBe(900);    // 3² × 100
    expect(levelThreshold(5)).toBe(2500);   // 5² × 100
    expect(levelThreshold(10)).toBe(10000); // 10² × 100
  });

  it('deve crescer quadraticamente (cada nível exige mais XP)', () => {
    const diff1to2 = levelThreshold(2) - levelThreshold(1); // 300
    const diff2to3 = levelThreshold(3) - levelThreshold(2); // 500
    const diff3to4 = levelThreshold(4) - levelThreshold(3); // 700

    expect(diff2to3).toBeGreaterThan(diff1to2);
    expect(diff3to4).toBeGreaterThan(diff2to3);
  });
});

// ---------------------------------------------------------------------------
// updateStreak — requer mock do Supabase
// ---------------------------------------------------------------------------

describe('updateStreak', () => {
  const userId = 'user-123';

  // Data de hoje e ontem no formato ISO YYYY-MM-DD
  const today     = new Date().toISOString().split('T')[0]!;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]!;
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().split('T')[0]!;

  beforeEach(() => {
    jest.clearAllMocks();
    // rpc usado pelo recordTransaction (bônus de marco)
    mockRpc.mockResolvedValue({ error: null });
  });

  it('não deve alterar streak se já registrou atividade hoje', async () => {
    const profileData = { current_streak: 7, longest_streak: 7, last_active_date: today };
    mockFrom.mockReturnValue(mockSelectSingle(profileData));

    const result = await updateStreak(userId);

    expect(result.newStreak).toBe(7);
    expect(result.milestoneReached).toBeNull();
  });

  it('deve incrementar streak se última atividade foi ontem', async () => {
    const profileData = { current_streak: 4, longest_streak: 4, last_active_date: yesterday };

    // Primeira chamada: select do perfil
    // Segunda chamada: update do perfil
    mockFrom
      .mockReturnValueOnce(mockSelectSingle(profileData))
      .mockReturnValueOnce(mockUpdate());

    const result = await updateStreak(userId);

    expect(result.newStreak).toBe(5);
    expect(result.milestoneReached).toBeNull();
  });

  it('deve resetar streak para 1 se ficou mais de 1 dia inativo', async () => {
    const profileData = {
      current_streak:   15,
      longest_streak:   15,
      last_active_date: twoDaysAgo,
    };

    mockFrom
      .mockReturnValueOnce(mockSelectSingle(profileData))
      .mockReturnValueOnce(mockUpdate());

    const result = await updateStreak(userId);

    expect(result.newStreak).toBe(1);
  });

  it('deve detectar marco de streak e retornar milestoneReached', async () => {
    // Streak atual de 2 → vai chegar em 3 (marco STREAK_MILESTONES inclui 3)
    const profileData = { current_streak: 2, longest_streak: 2, last_active_date: yesterday };
    const txData = {
      id: 'tx-1', user_id: userId, amount: 50,
      reason: 'streak_bonus', reference_id: null, created_at: new Date().toISOString(),
    };

    mockFrom
      .mockReturnValueOnce(mockSelectSingle(profileData))      // select streak
      .mockReturnValueOnce(mockUpdate())                        // update streak
      .mockReturnValueOnce(mockInsertSingle(txData));           // insert transação do bônus

    const result = await updateStreak(userId);

    expect(result.newStreak).toBe(3);
    expect(result.milestoneReached).toBe(3);
  });

  it('deve iniciar streak em 1 quando last_active_date é null', async () => {
    const profileData = { current_streak: 0, longest_streak: 0, last_active_date: null };

    mockFrom
      .mockReturnValueOnce(mockSelectSingle(profileData))
      .mockReturnValueOnce(mockUpdate());

    const result = await updateStreak(userId);

    expect(result.newStreak).toBe(1);
  });

  it('deve consumir um freeze e preservar o streak quando perdeu exatamente 1 dia', async () => {
    // twoDaysAgo → daysSinceActive === 2, com 1 freeze disponível
    const profileData = {
      current_streak:   7,
      longest_streak:  10,
      last_active_date: twoDaysAgo,
      streak_freezes:   1,
    };

    mockFrom
      .mockReturnValueOnce(mockSelectSingle(profileData))  // select
      .mockReturnValueOnce(mockUpdate());                   // update (consome freeze)

    const result = await updateStreak(userId);

    expect(result.freezeUsed).toBe(true);
    expect(result.newStreak).toBe(7);      // streak preservado
    expect(result.milestoneReached).toBeNull();
  });

  it('deve resetar o streak quando perdeu 2+ dias sem freeze disponível', async () => {
    const profileData = {
      current_streak:   7,
      longest_streak:  10,
      last_active_date: twoDaysAgo,
      streak_freezes:   0,  // sem freeze → sem proteção
    };

    mockFrom
      .mockReturnValueOnce(mockSelectSingle(profileData))
      .mockReturnValueOnce(mockUpdate());

    const result = await updateStreak(userId);

    expect(result.freezeUsed).toBe(false);
    expect(result.newStreak).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// applyLatePenalty — função pura, sem mock
// ---------------------------------------------------------------------------

describe('applyLatePenalty', () => {
  it('aplica -10% para atraso de 0–12h (tier 1)', () => {
    // 6h overdue: floor(100 * 0.90) = 90
    expect(applyLatePenalty(100, 6)).toBe(90);
    // exatamente 12h (incluído no tier 1): floor(100 * 0.90) = 90
    expect(applyLatePenalty(100, 12)).toBe(90);
  });

  it('aplica -20% para atraso de 12–24h (tier 2)', () => {
    // 18h overdue: floor(100 * 0.80) = 80
    expect(applyLatePenalty(100, 18)).toBe(80);
    // exatamente 24h: floor(100 * 0.80) = 80
    expect(applyLatePenalty(100, 24)).toBe(80);
  });

  it('aplica -35% para atraso de 24–48h (tier 3)', () => {
    // 36h overdue: floor(100 * 0.65) = 65
    expect(applyLatePenalty(100, 36)).toBe(65);
  });

  it('aplica -50% para atraso de 48–72h (tier 4)', () => {
    // 60h overdue: floor(100 * 0.50) = 50
    expect(applyLatePenalty(100, 60)).toBe(50);
  });

  it('aplica -60% para atraso acima de 72h (tier 5)', () => {
    // 96h overdue: floor(100 * 0.40) = 40
    expect(applyLatePenalty(100, 96)).toBe(40);
    // atraso muito grande: floor(100 * 0.40) = 40
    expect(applyLatePenalty(100, 9999)).toBe(40);
  });

  it('garante mínimo de 1 ponto independente da penalidade', () => {
    // 1 ponto base com -60%: floor(1 * 0.40) = 0 → deve retornar 1
    expect(applyLatePenalty(1, 200)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// checkLevelUp — requer mock do Supabase
// ---------------------------------------------------------------------------

describe('checkLevelUp', () => {
  const userId = 'user-456';

  beforeEach(() => jest.clearAllMocks());

  it('deve retornar leveledUp false quando pontos estão abaixo do próximo limiar', async () => {
    // Nível 1 exige 100 pts para subir para 2 (threshold = 2² × 100 = 400)
    const profileData = { level: 1, total_points: 350 };
    mockFrom.mockReturnValue(mockSelectSingle(profileData));

    const result = await checkLevelUp(userId);

    expect(result.leveledUp).toBe(false);
    expect(result.newLevel).toBe(1);
  });

  it('deve retornar leveledUp true quando pontos ultrapassam o limiar do próximo nível', async () => {
    // 500 pontos → nível 2 (sem recompensa cadastrada)
    const profileData = { level: 1, total_points: 500 };

    mockFrom
      .mockReturnValueOnce(mockSelectSingle(profileData))  // select profiles
      .mockReturnValueOnce(mockUpdate())                   // update level
      .mockReturnValueOnce(mockSelectMaybeSingle(null));   // level_rewards (sem recompensa)

    const result = await checkLevelUp(userId);

    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toBe(2);
    expect(result.levelReward).toBeNull();
  });

  it('deve calcular corretamente o nível em diferentes limiares de pontos', async () => {
    // 2500 pontos → nível 5 (5² × 100 = 2500); mock retorna sem recompensa para isolar o cálculo
    const profileData = { level: 1, total_points: 2500 };

    mockFrom
      .mockReturnValueOnce(mockSelectSingle(profileData))
      .mockReturnValueOnce(mockUpdate())
      .mockReturnValueOnce(mockSelectMaybeSingle(null));

    const result = await checkLevelUp(userId);

    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toBe(5);
  });

  it('deve conceder recompensa ao atingir nível marco (ex: nível 5)', async () => {
    const profileData = { level: 4, total_points: 2500, streak_freezes: 0 };
    const rewardData  = {
      level: 5, bonus_points: 50, bonus_freezes: 1,
      badge_key: 'rocket', description: 'Nível 5 desbloqueado!',
    };
    const txData = {
      id: 'tx-reward', user_id: userId, amount: 50,
      reason: 'level_reward', reference_id: null, created_at: new Date().toISOString(),
    };

    mockFrom
      .mockReturnValueOnce(mockSelectSingle(profileData))    // select profiles
      .mockReturnValueOnce(mockUpdate())                      // update level
      .mockReturnValueOnce(mockSelectMaybeSingle(rewardData))// level_rewards
      .mockReturnValueOnce(mockInsertSingle(txData))         // insert tx (bônus pts)
      .mockReturnValueOnce(mockUpdate());                     // update streak_freezes

    const result = await checkLevelUp(userId);

    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toBe(5);
    expect(result.levelReward).toMatchObject({
      level:        5,
      bonusPoints:  50,
      bonusFreezes: 1,
      badgeKey:     'rocket',
    });
  });

  it('deve retornar levelReward null para nível sem recompensa cadastrada', async () => {
    const profileData = { level: 1, total_points: 500, streak_freezes: 0 };

    mockFrom
      .mockReturnValueOnce(mockSelectSingle(profileData))
      .mockReturnValueOnce(mockUpdate())
      .mockReturnValueOnce(mockSelectMaybeSingle(null));

    const result = await checkLevelUp(userId);

    expect(result.levelReward).toBeNull();
    expect(result.leveledUp).toBe(true);
  });

  it('não deve atualizar o banco quando o nível não muda', async () => {
    const profileData = { level: 3, total_points: 950 };
    const selectMock = mockSelectSingle(profileData);
    mockFrom.mockReturnValue(selectMock);

    await checkLevelUp(userId);

    // update não deve ter sido chamado
    expect(selectMock.select).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
