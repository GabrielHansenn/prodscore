import {
  FreezeEventType,
  FREEZE_MAX_BALANCE,
  FREEZE_STREAK_INTERVAL,
  daysUntilNextFreeze,
  type FreezeState,
  type StreakFreezeEvent,
} from '@prodscore/shared';
import { supabase } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';

interface FreezeEventRow {
  id:            string;
  type:          FreezeEventType;
  balance_after: number;
  streak_day:    number | null;
  created_at:    string;
}

interface FreezeProfileRow {
  streak_freezes:          number;
  freeze_armed_at:         string | null;
  freeze_streak_credited:  number;
  current_streak:          number;
}

const PROFILE_COLUMNS = 'streak_freezes, freeze_armed_at, freeze_streak_credited, current_streak';

function mapEvent(row: FreezeEventRow): StreakFreezeEvent {
  return {
    id:           row.id,
    type:         row.type,
    balanceAfter: row.balance_after,
    streakDay:    row.streak_day,
    createdAt:    row.created_at,
  };
}

async function getProfile(userId: string): Promise<FreezeProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();

  if (error || !data) throw new AppError('Perfil não encontrado.', 404);
  return data as FreezeProfileRow;
}

/**
 * Registra um evento no histórico. Nunca lança: o histórico é auditoria e não
 * pode derrubar a operação que o originou (mesma decisão de createNotification).
 */
export async function recordFreezeEvent(
  userId: string,
  type: FreezeEventType,
  balanceAfter: number,
  streakDay?: number,
): Promise<void> {
  try {
    const { error } = await supabase.from('streak_freeze_events').insert({
      user_id:       userId,
      type,
      balance_after: balanceAfter,
      streak_day:    streakDay ?? null,
    });
    if (error) console.error('[freeze.service.recordFreezeEvent] falhou:', error, { type, userId });
  } catch (err) {
    console.error('[freeze.service.recordFreezeEvent] exceção:', err, { type, userId });
  }
}

// ---------------------------------------------------------------------------
// Ganho
// ---------------------------------------------------------------------------

/**
 * Concede freezes respeitando o teto (FREEZE_MAX_BALANCE), qualquer que seja a
 * fonte — streak, recompensa de nível ou compra. Devolve quantos foram
 * efetivamente creditados (0 quando o saldo já estava no teto).
 *
 * @param currentBalance - saldo atual, quando o chamador já o tem em mãos
 *                         (evita reler o perfil no meio de updateStreak)
 */
export async function grantFreezes(
  userId: string,
  amount: number,
  source: FreezeEventType.EarnedStreak | FreezeEventType.EarnedLevel | FreezeEventType.Purchased,
  options: { currentBalance?: number; streakDay?: number } = {},
): Promise<{ granted: number; newBalance: number }> {
  const currentBalance = options.currentBalance ?? (await getProfile(userId)).streak_freezes;
  const newBalance = Math.min(currentBalance + amount, FREEZE_MAX_BALANCE);
  const granted    = newBalance - currentBalance;

  if (granted > 0) {
    const { error } = await supabase
      .from('profiles')
      .update({ streak_freezes: newBalance })
      .eq('id', userId);

    if (error) {
      console.error('[freeze.service.grantFreezes] update falhou:', error.message);
      return { granted: 0, newBalance: currentBalance };
    }
  }

  await recordFreezeEvent(
    userId,
    granted > 0 ? source : FreezeEventType.Capped,
    newBalance,
    options.streakDay,
  );

  return { granted, newBalance };
}

/**
 * Crédito de freeze por progresso de streak: 1 a cada FREEZE_STREAK_INTERVAL
 * dias consecutivos.
 *
 * Anti-abuso: o crédito é ancorado em `freeze_streak_credited` (maior patamar
 * já creditado), não no tempo decorrido. Ao creditar, o patamar avança MESMO se
 * o ganho for descartado pelo teto — senão, usar um freeze depois liberaria
 * espaço e o usuário receberia retroativamente todos os patamares antigos.
 *
 * Deve ser chamada dentro do mesmo fluxo que persiste o novo streak.
 */
export async function creditStreakFreeze(
  userId: string,
  newStreak: number,
  creditedSoFar: number,
  currentBalance: number,
): Promise<{ granted: number; newBalance: number; newCredited: number }> {
  const milestone = Math.floor(newStreak / FREEZE_STREAK_INTERVAL) * FREEZE_STREAK_INTERVAL;

  if (milestone === 0 || milestone <= creditedSoFar) {
    return { granted: 0, newBalance: currentBalance, newCredited: creditedSoFar };
  }

  const { granted, newBalance } = await grantFreezes(userId, 1, FreezeEventType.EarnedStreak, {
    currentBalance,
    streakDay: milestone,
  });

  return { granted, newBalance, newCredited: milestone };
}

// ---------------------------------------------------------------------------
// Armar / desarmar
// ---------------------------------------------------------------------------

/**
 * Arma um freeze: a partir daqui, um dia perdido passa a ser protegido.
 *
 * Não debita nada — o consumo acontece só quando um dia é efetivamente
 * perdido (em updateStreak). Armar é a autorização prévia que impede o
 * resgate retroativo de dias já perdidos.
 */
export async function armFreeze(userId: string): Promise<FreezeState> {
  const profile = await getProfile(userId);

  if (profile.streak_freezes <= 0) {
    throw new AppError('Você não tem freezes disponíveis.', 400, 'SEM_FREEZES');
  }
  if (profile.freeze_armed_at) {
    throw new AppError('Você já tem um freeze armado.', 409, 'FREEZE_JA_ARMADO');
  }

  const armedAt = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({ freeze_armed_at: armedAt })
    .eq('id', userId);

  if (error) throw new AppError('Erro ao armar o freeze.', 500, 'ARM_FALHOU');

  await recordFreezeEvent(userId, FreezeEventType.Armed, profile.streak_freezes);

  return buildState({ ...profile, freeze_armed_at: armedAt });
}

/** Desarma o freeze antes de usar — o saldo não muda. */
export async function disarmFreeze(userId: string): Promise<FreezeState> {
  const profile = await getProfile(userId);

  if (!profile.freeze_armed_at) {
    throw new AppError('Nenhum freeze armado.', 409, 'FREEZE_NAO_ARMADO');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ freeze_armed_at: null })
    .eq('id', userId);

  if (error) throw new AppError('Erro ao desarmar o freeze.', 500, 'DISARM_FALHOU');

  await recordFreezeEvent(userId, FreezeEventType.Disarmed, profile.streak_freezes);

  return buildState({ ...profile, freeze_armed_at: null });
}

// ---------------------------------------------------------------------------
// Estado e histórico
// ---------------------------------------------------------------------------

function buildState(profile: FreezeProfileRow): FreezeState {
  return {
    balance:             profile.streak_freezes,
    maxBalance:          FREEZE_MAX_BALANCE,
    armedAt:             profile.freeze_armed_at,
    currentStreak:       profile.current_streak,
    daysUntilNextFreeze: daysUntilNextFreeze(profile.current_streak),
    atMaxBalance:        profile.streak_freezes >= FREEZE_MAX_BALANCE,
  };
}

/** Estado consolidado do freeze para a dashboard. */
export async function getFreezeState(userId: string): Promise<FreezeState> {
  return buildState(await getProfile(userId));
}

/** Histórico de ganho/uso (mais recentes primeiro). */
export async function listFreezeEvents(userId: string, limit = 20): Promise<StreakFreezeEvent[]> {
  const { data, error } = await supabase
    .from('streak_freeze_events')
    .select('id, type, balance_after, streak_day, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new AppError('Erro ao carregar o histórico de freezes.', 500, 'BUSCA_FALHOU');
  return (data as FreezeEventRow[]).map(mapEvent);
}
