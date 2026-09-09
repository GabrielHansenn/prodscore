import {
  MissionType,
  PointReason,
  type Mission,
  type Achievement,
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

/**
 * Converte a linha do banco para a interface Mission, com progresso injetado.
 *
 * Para missões de grupo, o progresso é coletivo: `groupTotalValue` deve ser a
 * soma de `current_value` de TODOS os participantes da missão, não apenas do
 * usuário que está consultando — do contrário cada membro veria um número
 * diferente (o próprio, em vez do total do grupo). Para missões individuais,
 * `groupTotalValue` é ignorado e o progresso é sempre o do próprio `participant`.
 */
function mapMissionRow(
  row: MissionRow,
  participant?: ParticipantRow | null,
  groupTotalValue?: number,
): Mission {
  const isGroup = row.type === 'group';
  const currentValue = isGroup ? (groupTotalValue ?? 0) : (participant?.current_value ?? 0);
  return {
    id:           row.id,
    title:        row.title,
    description:  row.description,
    type:         row.type as MissionType,
    groupId:      row.group_id,
    targetValue:  row.target_value,
    rewardPoints: row.reward_points,
    expiresAt:    row.expires_at,
    // Missão de grupo: "concluída" é o time ter batido a meta (igual pra todos).
    // Missão individual: reflete a própria participação do usuário.
    isCompleted:  isGroup ? currentValue >= row.target_value : (participant?.is_completed ?? false),
    currentValue,
    createdAt:    row.created_at,
  };
}

/** Soma o current_value de uma lista de linhas de mission_participants */
function sumParticipantsValue(rows: Array<{ current_value: number }>): number {
  return rows.reduce((sum, r) => sum + r.current_value, 0);
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

  // Para missões de grupo, o progresso exibido é o total do grupo (soma de
  // TODOS os participantes), não só do usuário — busca em lote, sem filtrar
  // por user_id, e soma por missão.
  const groupMissionIds = missions.filter((m) => m.type === 'group').map((m) => m.id);
  const groupTotals = new Map<string, number>();
  if (groupMissionIds.length > 0) {
    const { data: allParticipantsData } = await supabase
      .from('mission_participants')
      .select('mission_id, current_value')
      .in('mission_id', groupMissionIds);

    for (const row of (allParticipantsData ?? []) as Array<{ mission_id: string; current_value: number }>) {
      groupTotals.set(row.mission_id, (groupTotals.get(row.mission_id) ?? 0) + row.current_value);
    }
  }

  return missions.map((mission) => {
    const participant = participationMap.get(mission.id) ?? null;
    return {
      ...mapMissionRow(mission, participant, groupTotals.get(mission.id)),
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

  // Para missões de grupo, busca o placar completo com perfis.
  // Não dá pra usar o embed automático `profiles(...)` do PostgREST aqui:
  // não existe FK direta entre mission_participants e profiles (ambas
  // referenciam auth.users, mas não uma à outra), então esse embed falha
  // silenciosamente. Busca em duas etapas e junta em JS.
  let leaderboard: MissionDetails['leaderboard'] = [];
  let groupTotalValue: number | undefined;

  if (mission.type === 'group') {
    const { data: participantsData } = await supabase
      .from('mission_participants')
      .select('user_id, current_value, is_completed')
      .eq('mission_id', missionId)
      .order('current_value', { ascending: false });

    const participantsRows = (participantsData ?? []) as Array<{
      user_id: string; current_value: number; is_completed: boolean;
    }>;

    groupTotalValue = sumParticipantsValue(participantsRows);

    const userIds = participantsRows.map((r) => r.user_id);
    const profilesMap = new Map<string, { username: string; avatar_url: string | null }>();
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      for (const p of (profilesData ?? []) as Array<{ id: string; username: string; avatar_url: string | null }>) {
        profilesMap.set(p.id, { username: p.username, avatar_url: p.avatar_url });
      }
    }

    leaderboard = participantsRows.map((row) => {
      const profile = profilesMap.get(row.user_id);
      return {
        userId:       row.user_id,
        username:     profile?.username ?? '???',
        avatarUrl:    profile?.avatar_url ?? null,
        currentValue: row.current_value,
        isCompleted:  row.is_completed,
      };
    });
  }

  return {
    ...mapMissionRow(mission, participant, groupTotalValue),
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

  // Busca TODOS os participantes dessas missões (não só o usuário logado) —
  // são todas missões de grupo, então o progresso exibido é o total do grupo,
  // igual pra todo mundo. A própria participação do usuário vem do mesmo lote.
  const { data: allParticipantsData } = await supabase
    .from('mission_participants')
    .select('*')
    .in('mission_id', missionIds);

  const allParticipants = (allParticipantsData ?? []) as ParticipantRow[];

  const participationMap = new Map<string, ParticipantRow>();
  const groupTotals = new Map<string, number>();
  for (const row of allParticipants) {
    if (row.user_id === userId) participationMap.set(row.mission_id, row);
    groupTotals.set(row.mission_id, (groupTotals.get(row.mission_id) ?? 0) + row.current_value);
  }

  return missions.map((mission) => {
    const participant = participationMap.get(mission.id) ?? null;
    return {
      ...mapMissionRow(mission, participant, groupTotals.get(mission.id)),
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

/** Missão concluída durante um checkMissionProgress — usado pra devolver o bônus ao chamador */
export interface CompletedMissionInfo {
  missionId:    string;
  title:        string;
  rewardPoints: number;
}

/** Resultado agregado de checkMissionProgress */
export interface MissionProgressResult {
  completedMissions:   CompletedMissionInfo[];
  /** Conquistas desbloqueadas pelo bônus de pontos da missão (só do usuário que agiu) */
  unlockedAchievements: Achievement[];
}

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
 * @returns Missões concluídas nesta chamada e conquistas desbloqueadas pelo bônus
 *          delas (vazio se nenhuma) — usado pelo caller (completeTask) pra incluir
 *          tudo isso no mesmo popup de XP/conquista.
 */
export async function checkMissionProgress(userId: string): Promise<MissionProgressResult> {
  const completed: CompletedMissionInfo[] = [];
  const unlockedAchievements: Achievement[] = [];
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
          id, title, type, group_id, target_value, reward_points, expires_at
        )
      `)
      .eq('user_id', userId)
      .eq('is_completed', false);

    if (error || !participationsData) return { completedMissions: completed, unlockedAchievements };

    const participations = participationsData as unknown as Array<{
      mission_id:  string;
      current_value: number;
      joined_at:   string;
      missions:    Pick<MissionRow, 'id' | 'title' | 'type' | 'group_id' | 'target_value' | 'reward_points' | 'expires_at'>;
    }>;

    // Para missões de grupo, busca se o grupo permite contar tarefas de fora
    // (padrão: não conta — só tarefas com group_id igual ao da missão).
    const missionGroupIds = Array.from(
      new Set(
        participations
          .map((p) => p.missions.group_id)
          .filter((id): id is string => id !== null),
      ),
    );

    const externalTasksAllowedByGroup = new Map<string, boolean>();
    if (missionGroupIds.length > 0) {
      const { data: groupsData } = await supabase
        .from('groups')
        .select('id, count_external_tasks_in_missions')
        .in('id', missionGroupIds);

      for (const g of (groupsData ?? []) as Array<{ id: string; count_external_tasks_in_missions: boolean }>) {
        externalTasksAllowedByGroup.set(g.id, g.count_external_tasks_in_missions);
      }
    }

    for (const participation of participations) {
      const mission = participation.missions;

      // Ignora missões expiradas
      if (isMissionExpired(mission.expires_at)) continue;

      // Conta as tarefas concluídas pelo usuário desde que entrou na missão.
      // Missões de grupo só contam tarefas do próprio grupo, a menos que o
      // grupo tenha habilitado explicitamente contar tarefas externas.
      let tasksQuery = supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('completed_at', participation.joined_at);

      if (
        mission.type === 'group' &&
        mission.group_id &&
        !externalTasksAllowedByGroup.get(mission.group_id)
      ) {
        tasksQuery = tasksQuery.eq('group_id', mission.group_id);
      }

      const { count: completedCount } = await tasksQuery;

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
        let achievementsFromMission: Achievement[] = [];
        if (mission.type === 'group' && mission.group_id) {
          // Meta coletiva batida — recompensa TODO o grupo, não só quem
          // completou a tarefa que fechou a conta.
          achievementsFromMission = await completeGroupMissionForAllMembers(
            participation.mission_id, mission.group_id, mission.reward_points, userId,
          );
        } else {
          achievementsFromMission = await completeMission(participation.mission_id, userId, mission.reward_points);
        }
        completed.push({
          missionId:    participation.mission_id,
          title:        mission.title,
          rewardPoints: mission.reward_points,
        });
        unlockedAchievements.push(...achievementsFromMission);
      }
    }
  } catch (err) {
    // Não interrompe o fluxo principal — apenas loga o erro
    console.error('[missões] Erro ao verificar progresso de missões:', err);
  }
  return { completedMissions: completed, unlockedAchievements };
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
): Promise<Achievement[]> {
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
    return [];
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

  // Verifica novas conquistas após ganhar os pontos da missão — o bônus pode
  // ter empurrado o usuário sobre um critério (ex: pontos acumulados) que só
  // seria detectado aqui, então o resultado precisa ser devolvido, não descartado.
  try {
    return await checkAchievements(userId);
  } catch (err) {
    console.error('[missões] Erro ao verificar conquistas após missão:', err);
    return [];
  }
}

/**
 * Marca uma missão de GRUPO como concluída para TODOS os membros do grupo e
 * concede a recompensa a cada um deles — a meta é coletiva, então a recompensa
 * também é. Isso inclui membros que nunca completaram uma tarefa e por isso
 * ainda não tinham linha em mission_participants (criada aqui, já concluída).
 *
 * Idempotente: só recompensa quem ainda não tinha sido marcado como concluído.
 *
 * @param missionId     - UUID da missão de grupo
 * @param groupId       - UUID do grupo (mission.group_id)
 * @param rewardPoints  - Pontos a conceder a cada membro
 * @param actingUserId  - Usuário cuja ação disparou esta conclusão — só as
 *                        conquistas desbloqueadas para ELE são retornadas, pois
 *                        é o único com uma requisição em andamento pra receber
 *                        essa informação agora. Os demais membros do grupo
 *                        também podem desbloquear conquistas aqui, mas não há
 *                        hoje um canal pra avisá-los fora da própria sessão.
 * @returns Conquistas desbloqueadas para `actingUserId` nesta chamada
 */
async function completeGroupMissionForAllMembers(
  missionId: string,
  groupId: string,
  rewardPoints: number,
  actingUserId: string,
): Promise<Achievement[]> {
  const now = new Date().toISOString();

  const { data: membersData } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);

  const memberIds = (membersData ?? []).map((m) => (m as { user_id: string }).user_id);
  if (memberIds.length === 0) return [];

  const { data: existingData } = await supabase
    .from('mission_participants')
    .select('user_id, is_completed')
    .eq('mission_id', missionId)
    .in('user_id', memberIds);

  const existingRows = (existingData ?? []) as Array<{ user_id: string; is_completed: boolean }>;
  const existingMap = new Map(existingRows.map((r) => [r.user_id, r.is_completed]));

  // Membros que já participavam mas ainda não tinham sido marcados como concluídos
  const toUpdate = memberIds.filter((id) => existingMap.get(id) === false);
  if (toUpdate.length > 0) {
    await supabase
      .from('mission_participants')
      .update({ is_completed: true, completed_at: now })
      .eq('mission_id', missionId)
      .in('user_id', toUpdate);
  }

  // Membros que nunca completaram nenhuma tarefa do grupo e por isso nunca
  // tinham entrado na missão — criados aqui já como concluídos.
  const toInsert = memberIds.filter((id) => !existingMap.has(id));
  if (toInsert.length > 0) {
    await supabase.from('mission_participants').insert(
      toInsert.map((id) => ({
        mission_id:    missionId,
        user_id:       id,
        current_value: 0,
        is_completed:  true,
        completed_at:  now,
      })),
    );
  }

  const rewardedUserIds = [...toUpdate, ...toInsert];

  if (rewardPoints > 0) {
    await Promise.all(rewardedUserIds.map(async (id) => {
      try {
        await recordTransaction(id, rewardPoints, PointReason.MissionReward, missionId);
      } catch (err) {
        console.error(`[missões] Erro ao conceder recompensa de missão de grupo para ${id}:`, err);
      }
    }));
    console.log(`[missões] Recompensa de ${rewardPoints} pts concedida a ${rewardedUserIds.length} membro(s) na missão de grupo ${missionId}`);
  }

  let actingUserAchievements: Achievement[] = [];

  await Promise.all(rewardedUserIds.map(async (id) => {
    try {
      const unlocked = await checkAchievements(id);
      if (id === actingUserId) actingUserAchievements = unlocked;
    } catch (err) {
      console.error(`[missões] Erro ao verificar conquistas após missão de grupo para ${id}:`, err);
    }
  }));

  return actingUserAchievements;
}
