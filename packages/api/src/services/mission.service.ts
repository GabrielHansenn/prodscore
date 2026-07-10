import {
  MissionType,
  PointReason,
  type Mission,
} from '@prodscore/shared';
import { supabase } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';
import {
  recordTransaction,
  checkAchievements,
} from './gamification.service.js';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface MissionRow {
  id: string;
  title: string;
  description: string;
  type: string;
  group_id: string | null;
  target_value: number;
  reward_points: number;
  expires_at: string | null;
  created_at: string;
}

interface ParticipantRow {
  mission_id: string;
  user_id: string;
  current_value: number;
  is_completed: boolean;
  completed_at: string | null;
  joined_at: string;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Converte a linha do banco para a interface Mission, com progresso injetado */
function mapMissionRow(
  row: MissionRow,
  participant?: ParticipantRow | null,
): Mission {
  return {
    id:           row.id,
    title:        row.title,
    description:  row.description,
    type:         row.type as MissionType,
    groupId:      row.group_id,
    targetValue:  row.target_value,
    rewardPoints: row.reward_points,
    expiresAt:    row.expires_at,
    isCompleted:  participant?.is_completed ?? false,
    currentValue: participant?.current_value ?? 0,
    createdAt:    row.created_at,
  };
}

/** Verifica se uma missão expirou */
function isMissionExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// ---------------------------------------------------------------------------
// Listagem de missões com progresso
// ---------------------------------------------------------------------------

export interface MissionWithParticipation extends Mission {
  /** Se o usuário já está participando desta missão */
  isParticipating: boolean;
  /** Progresso do usuário (null se não participa) */
  joinedAt: string | null;
}

/**
 * Retorna as missões disponíveis para o usuário com seu progresso atual.
 *
 * Inclui:
 * - Missões individuais ativas (disponíveis para todos)
 * - Missões dos grupos dos quais o usuário é membro
 *
 * @param userId - UUID do usuário autenticado
 */
export async function getMissionsForUser(
  userId: string,
): Promise<MissionWithParticipation[]> {
  // Busca IDs dos grupos do usuário
  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  const groupIds = (memberships ?? []).map(
    (m) => (m as { group_id: string }).group_id,
  );

  // Busca todas as missões disponíveis (individuais + dos grupos do usuário)
  let missionsQuery = supabase
    .from('missions')
    .select('*')
    .or('expires_at.is.null,expires_at.gt.now()');

  if (groupIds.length > 0) {
    // Missões individuais OU missões dos grupos do usuário
    missionsQuery = missionsQuery.or(
      `type.eq.individual,group_id.in.(${groupIds.join(',')})`,
    );
  } else {
    // Apenas missões individuais
    missionsQuery = missionsQuery.eq('type', 'individual');
  }

  const { data: missionsData, error: missionsError } = await missionsQuery.order('created_at', { ascending: false });

  if (missionsError) {
    throw new AppError('Erro ao buscar missões.', 500, 'BUSCA_FALHOU');
  }

  const missions = (missionsData ?? []) as MissionRow[];
  if (missions.length === 0) return [];

  const missionIds = missions.map((m) => m.id);

  // Busca participações do usuário em todas essas missões (batch)
  const { data: participationData } = await supabase
    .from('mission_participants')
    .select('*')
    .eq('user_id', userId)
    .in('mission_id', missionIds);

  const participationMap = new Map<string, ParticipantRow>();
  (participationData ?? []).forEach((p) => {
    const row = p as ParticipantRow;
    participationMap.set(row.mission_id, row);
  });

  return missions.map((mission) => {
    const participant = participationMap.get(mission.id) ?? null;
    return {
      ...mapMissionRow(mission, participant),
      isParticipating: participant !== null,
      joinedAt:        participant?.joined_at ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Detalhes de uma missão
// ---------------------------------------------------------------------------

export interface MissionDetails extends Mission {
  isParticipating: boolean;
  joinedAt: string | null;
  /** Placar de participantes (preenchido apenas para missões de grupo) */
  leaderboard: Array<{
    userId:       string;
    username:     string;
    avatarUrl:    string | null;
    currentValue: number;
    isCompleted:  boolean;
  }>;
}

/**
 * Retorna detalhes completos de uma missão.
 * Para missões de grupo, inclui placar dos participantes.
 *
 * @param missionId - UUID da missão
 * @param userId    - UUID do usuário autenticado
 */
export async function getMissionById(
  missionId: string,
  userId: string,
): Promise<MissionDetails> {
  const { data: missionData, error } = await supabase
    .from('missions')
    .select('*')
    .eq('id', missionId)
    .single();

  if (error || !missionData) {
    throw new AppError('Missão não encontrada.', 404, 'MISSAO_NAO_ENCONTRADA');
  }

  const mission = missionData as MissionRow;

  // Para missões de grupo: verifica se o usuário é membro
  if (mission.type === 'group' && mission.group_id) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', mission.group_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      throw new AppError(
        'Você não tem acesso a esta missão de grupo.',
        403,
        'ACESSO_NEGADO',
      );
    }
  }

  // Busca participação do usuário nesta missão
  const { data: participantData } = await supabase
    .from('mission_participants')
    .select('*')
    .eq('mission_id', missionId)
    .eq('user_id', userId)
    .maybeSingle();

  const participant = (participantData ?? null) as ParticipantRow | null;

  // Para missões de grupo, busca o placar completo com perfis
  let leaderboard: MissionDetails['leaderboard'] = [];

  if (mission.type === 'group') {
    const { data: participantsData } = await supabase
      .from('mission_participants')
      .select(`
        user_id, current_value, is_completed,
        profiles (username, avatar_url)
      `)
      .eq('mission_id', missionId)
      .order('current_value', { ascending: false });

    leaderboard = (participantsData ?? []).map((p) => {
      const row = p as {
        user_id: string; current_value: number; is_completed: boolean;
        profiles: { username: string; avatar_url: string | null };
      };
      return {
        userId:       row.user_id,
        username:     row.profiles.username,
        avatarUrl:    row.profiles.avatar_url,
        currentValue: row.current_value,
        isCompleted:  row.is_completed,
      };
    });
  }

  return {
    ...mapMissionRow(mission, participant),
    isParticipating: participant !== null,
    joinedAt:        participant?.joined_at ?? null,
    leaderboard,
  };
}

// ---------------------------------------------------------------------------
// Entrar em uma missão
// ---------------------------------------------------------------------------

/**
 * Registra a participação do usuário em uma missão individual ativa.
 * Missões de grupo têm entrada automática ao completar tarefas do grupo.
 *
 * @param missionId - UUID da missão
 * @param userId    - UUID do usuário
 */
export async function joinMission(
  missionId: string,
  userId: string,
): Promise<{ mission: Mission; joinedAt: string }> {
  const { data: missionData, error: missionError } = await supabase
    .from('missions')
    .select('*')
    .eq('id', missionId)
    .single();

  if (missionError || !missionData) {
    throw new AppError('Missão não encontrada.', 404, 'MISSAO_NAO_ENCONTRADA');
  }

  const mission = missionData as MissionRow;

  if (isMissionExpired(mission.expires_at)) {
    throw new AppError('Esta missão já expirou.', 410, 'MISSAO_EXPIRADA');
  }

  // Missões de grupo não aceitam entrada manual via esta rota
  if (mission.type === 'group') {
    throw new AppError(
      'Missões de grupo têm entrada automática. Apenas missões individuais aceitam inscrição manual.',
      400,
      'MISSAO_GRUPO_ENTRADA_AUTO',
    );
  }

  // Verifica se já participa
  const { data: existing } = await supabase
    .from('mission_participants')
    .select('user_id, joined_at')
    .eq('mission_id', missionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    throw new AppError(
      'Você já está participando desta missão.',
      409,
      'JA_PARTICIPA',
    );
  }

  // Registra a participação com progresso inicial zerado
  const { data: participantData, error: insertError } = await supabase
    .from('mission_participants')
    .insert({
      mission_id:    missionId,
      user_id:       userId,
      current_value: 0,
      is_completed:  false,
    })
    .select('joined_at')
    .single();

  if (insertError || !participantData) {
    throw new AppError('Erro ao entrar na missão.', 500, 'JOIN_FALHOU');
  }

  const joinedAt = (participantData as { joined_at: string }).joined_at;

  return { mission: mapMissionRow(mission, null), joinedAt };
}

// ---------------------------------------------------------------------------
// Missões de um grupo específico
// ---------------------------------------------------------------------------

/**
 * Retorna as missões ativas de um grupo com o progresso do usuário autenticado.
 * Verifica que o usuário é membro antes de retornar.
 */
export async function getMissionsForGroup(
  groupId: string,
  userId:  string,
): Promise<MissionWithParticipation[]> {
  const { data: membership } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    throw new AppError('Você não tem acesso a este grupo.', 403, 'ACESSO_NEGADO');
  }

  const { data: missionsData, error } = await supabase
    .from('missions')
    .select('*')
    .eq('type', 'group')
    .eq('group_id', groupId)
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('created_at', { ascending: false });

  if (error) throw new AppError('Erro ao buscar missões do grupo.', 500);

  const missions = (missionsData ?? []) as MissionRow[];
  if (missions.length === 0) return [];

  const missionIds = missions.map((m) => m.id);

  const { data: participationData } = await supabase
    .from('mission_participants')
    .select('*')
    .eq('user_id', userId)
    .in('mission_id', missionIds);

  const participationMap = new Map<string, ParticipantRow>();
  (participationData ?? []).forEach((p) => {
    const row = p as ParticipantRow;
    participationMap.set(row.mission_id, row);
  });

  return missions.map((mission) => {
    const participant = participationMap.get(mission.id) ?? null;
    return {
      ...mapMissionRow(mission, participant),
      isParticipating: participant !== null,
      joinedAt:        participant?.joined_at ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Criação de missão de grupo
// ---------------------------------------------------------------------------

/**
 * Cria uma missão coletiva para um grupo.
 * Apenas owner e admin do grupo podem criar missões.
 *
 * @param input      - Dados da missão
 * @param requesterId - UUID do usuário solicitante (deve ser owner ou admin)
 */
export async function createGroupMission(
  input: {
    groupId:      string;
    title:        string;
    description:  string;
    targetValue:  number;
    rewardPoints: number;
    expiresAt?:   string;
  },
  requesterId: string,
): Promise<Mission> {
  // Verifica se o solicitante é owner ou admin do grupo
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', input.groupId)
    .eq('user_id', requesterId)
    .maybeSingle();

  if (!membership) {
    throw new AppError('Você não é membro deste grupo.', 403, 'ACESSO_NEGADO');
  }

  const role = (membership as { role: string }).role;
  if (role !== 'owner' && role !== 'admin') {
    throw new AppError(
      'Apenas donos e admins podem criar missões para o grupo.',
      403,
      'SEM_PERMISSAO',
    );
  }

  const { data, error } = await supabase
    .from('missions')
    .insert({
      title:         input.title,
      description:   input.description,
      type:          'group',
      group_id:      input.groupId,
      target_value:  input.targetValue,
      reward_points: input.rewardPoints,
      expires_at:    input.expiresAt ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError('Erro ao criar missão de grupo.', 500, 'CRIACAO_FALHOU');
  }

  return mapMissionRow(data as MissionRow, null);
}

// ---------------------------------------------------------------------------
// Verificação e atualização de progresso
// ---------------------------------------------------------------------------

/**
 * Verifica e atualiza o progresso do usuário em todas as missões ativas após concluir uma tarefa.
 *
 * Para missões individuais: conta as tarefas concluídas pelo usuário desde que entrou na missão.
 * Para missões de grupo: incrementa o progresso do participante em 1 por tarefa concluída.
 *
 * Se a meta for atingida (individual) ou a soma dos participantes atingir o alvo (grupo),
 * a missão é marcada como concluída e a recompensa é concedida.
 *
 * Erros nesta função não interrompem o fluxo de conclusão da tarefa — apenas logados.
 *
 * @param userId - UUID do usuário que concluiu uma tarefa
 */
export async function checkMissionProgress(userId: string): Promise<void> {
  try {
    // Auto-matricula o usuário em missões de grupo ativas que ele ainda não entrou.
    // joined_at = created_at da missão para contar tarefas retroativamente desde o início.
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);

    const groupIds = (memberships ?? []).map(
      (m) => (m as { group_id: string }).group_id,
    );

    if (groupIds.length > 0) {
      const { data: groupMissions } = await supabase
        .from('missions')
        .select('id, created_at')
        .in('group_id', groupIds)
        .eq('type', 'group')
        .or('expires_at.is.null,expires_at.gt.now()');

      const groupMissionIds = (groupMissions ?? []).map(
        (m) => (m as { id: string; created_at: string }).id,
      );

      if (groupMissionIds.length > 0) {
        const { data: existingRows } = await supabase
          .from('mission_participants')
          .select('mission_id')
          .eq('user_id', userId)
          .in('mission_id', groupMissionIds);

        const alreadyIn = new Set(
          (existingRows ?? []).map(
            (p) => (p as { mission_id: string }).mission_id,
          ),
        );

        const toJoin = (groupMissions ?? []).filter(
          (m) => !alreadyIn.has((m as { id: string }).id),
        ) as Array<{ id: string; created_at: string }>;

        if (toJoin.length > 0) {
          await supabase.from('mission_participants').insert(
            toJoin.map((m) => ({
              mission_id:    m.id,
              user_id:       userId,
              current_value: 0,
              is_completed:  false,
              joined_at:     m.created_at,   // retroativo: conta desde o início da missão
            })),
          );
        }
      }
    }

    // Busca todas as participações ativas do usuário
    const { data: participationsData, error } = await supabase
      .from('mission_participants')
      .select(`
        mission_id, current_value, joined_at,
        missions (
          id, type, group_id, target_value, reward_points, expires_at
        )
      `)
      .eq('user_id', userId)
      .eq('is_completed', false);

    if (error || !participationsData) return;

    const participations = participationsData as Array<{
      mission_id:  string;
      current_value: number;
      joined_at:   string;
      missions:    Pick<MissionRow, 'id' | 'type' | 'group_id' | 'target_value' | 'reward_points' | 'expires_at'>;
    }>;

    for (const participation of participations) {
      const mission = participation.missions;

      // Ignora missões expiradas
      if (isMissionExpired(mission.expires_at)) continue;

      // Conta as tarefas concluídas pelo usuário desde que entrou na missão
      const { count: completedCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('completed_at', participation.joined_at);

      const newValue = completedCount ?? 0;

      // Sem progresso novo — pula
      if (newValue <= participation.current_value) continue;

      // Atualiza o progresso do participante
      await supabase
        .from('mission_participants')
        .update({ current_value: newValue })
        .eq('mission_id', participation.mission_id)
        .eq('user_id', userId);

      // Verifica se a missão foi concluída
      let missionCompleted = false;

      if (mission.type === 'individual') {
        missionCompleted = newValue >= mission.target_value;
      } else if (mission.type === 'group') {
        // Para missões de grupo: soma de todos os participantes
        const { data: allParticipants } = await supabase
          .from('mission_participants')
          .select('current_value')
          .eq('mission_id', participation.mission_id);

        const totalProgress = (allParticipants ?? []).reduce(
          (sum, p) => sum + ((p as { current_value: number }).current_value),
          0,
        );
        // Adiciona o incremento do usuário atual ao total
        missionCompleted =
          totalProgress - participation.current_value + newValue >= mission.target_value;
      }

      if (missionCompleted) {
        await completeMission(participation.mission_id, userId, mission.reward_points);
      }
    }
  } catch (err) {
    // Não interrompe o fluxo principal — apenas loga o erro
    console.error('[missões] Erro ao verificar progresso de missões:', err);
  }
}

// ---------------------------------------------------------------------------
// Conclusão de missão
// ---------------------------------------------------------------------------

/**
 * Marca a missão como concluída para o usuário e concede a recompensa em pontos.
 * Chamado internamente por checkMissionProgress ao atingir a meta.
 *
 * @param missionId    - UUID da missão
 * @param userId       - UUID do usuário
 * @param rewardPoints - Pontos de recompensa da missão
 */
export async function completeMission(
  missionId: string,
  userId: string,
  rewardPoints: number,
): Promise<void> {
  const now = new Date().toISOString();

  // Marca o participante como concluído
  const { error: updateError } = await supabase
    .from('mission_participants')
    .update({
      is_completed: true,
      completed_at: now,
    })
    .eq('mission_id', missionId)
    .eq('user_id', userId)
    .eq('is_completed', false);   // idempotente — evita dupla conclusão

  if (updateError) {
    console.error('[missões] Erro ao marcar missão como concluída:', updateError.message);
    return;
  }

  // Concede a recompensa em pontos (se houver)
  if (rewardPoints > 0) {
    try {
      await recordTransaction(
        userId,
        rewardPoints,
        PointReason.MissionReward,
        missionId,
      );
      console.log(`[missões] Recompensa de ${rewardPoints} pts concedida para missão ${missionId}`);
    } catch (err) {
      console.error('[missões] Erro ao conceder recompensa de missão:', err);
    }
  }

  // Verifica novas conquistas após ganhar os pontos da missão
  try {
    await checkAchievements(userId);
  } catch (err) {
    console.error('[missões] Erro ao verificar conquistas após missão:', err);
  }
}
