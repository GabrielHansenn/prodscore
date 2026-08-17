/**
 * Tipos e interfaces compartilhados entre web, mobile e API.
 * Todos os enums utilizam valores em inglês (padrão técnico do banco de dados).
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Dificuldade de uma tarefa — determina quantos pontos ela vale */
export enum TaskDifficulty {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard',
  Epic = 'epic',
}

/** Estado de ciclo de vida de uma tarefa */
export enum TaskStatus {
  Pending    = 'pending',
  InProgress = 'in_progress',
  Completed  = 'completed',
  Overdue    = 'overdue',
  Abandoned  = 'abandoned',
}

/** Urgência de negócio de uma tarefa — multiplicador de pontuação sobre a base de dificuldade */
export enum TaskPriority {
  Low    = 'low',
  Medium = 'medium',
  High   = 'high',
  Urgent = 'urgent',
}

/** Tipo de missão: individual (só o usuário) ou em grupo */
export enum MissionType {
  Individual = 'individual',
  Group = 'group',
}

/** Motivo pelo qual uma transação de pontos foi gerada */
export enum PointReason {
  TaskCompleted    = 'task_completed',
  StreakBonus      = 'streak_bonus',
  LatePenalty      = 'late_penalty',
  MissionReward    = 'mission_reward',
  AchievementBonus = 'achievement_bonus',
  FreezeShop       = 'freeze_shop',
  LevelReward      = 'level_reward',
}

/** Papel (função) de um membro dentro de um grupo */
export enum MemberRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
}

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

/**
 * Usuário da plataforma.
 * Extende o registro de autenticação do Supabase com dados de perfil e gamificação.
 */
export interface User {
  /** UUID gerado pelo Supabase Auth */
  id: string;
  /** Nome de usuário único e público */
  username: string;
  /** Endereço de e-mail */
  email: string;
  /** URL da imagem de avatar do usuário */
  avatarUrl: string | null;
  /** Breve descrição sobre o usuário */
  bio: string | null;
  /** Nível atual de gamificação (começa em 1) */
  level: number;
  /** Total de pontos acumulados */
  totalPoints: number;
  /** Quantidade de dias consecutivos com tarefas concluídas */
  currentStreak: number;
  /** Maior streak já atingido pelo usuário */
  longestStreak: number;
  /** Data da última vez que o usuário completou uma tarefa */
  lastActiveDate: string | null;
  /** Número de streak freezes disponíveis (protegem contra 1 dia perdido) */
  streakFreezes: number;
  /** Timestamp de criação do registro */
  createdAt: string;
}

/**
 * Tarefa criada por um usuário.
 * Pode estar associada a um grupo ou ser individual.
 */
export interface Task {
  /** UUID da tarefa */
  id: string;
  /** UUID do usuário dono da tarefa */
  userId: string;
  /** UUID do grupo ao qual pertence (nulo se for tarefa individual) */
  groupId: string | null;
  /** Título descritivo da tarefa */
  title: string;
  /** Descrição detalhada opcional */
  description: string | null;
  /** Nível de dificuldade que define a pontuação base */
  difficulty: TaskDifficulty;
  /** Estado atual da tarefa no ciclo de vida */
  status: TaskStatus;
  /** Urgência de negócio — multiplicador de pontuação (independente do esforço técnico) */
  priority: TaskPriority;
  /** Duração prevista em minutos (opcional, mínimo 1) */
  estimatedMinutes: number | null;
  /** Quando a tarefa se tornou overdue pela primeira vez (null se ainda não overdue) */
  overdueSince: string | null;
  /** Data limite para conclusão (ISO 8601) */
  dueDate: string | null;
  /** Timestamp de quando a tarefa foi marcada como concluída */
  completedAt: string | null;
  /** Pontos efetivamente ganhos ao concluir (pode incluir bônus ou penalidade) */
  pointsEarned: number | null;
  /** Timestamp de criação */
  createdAt: string;
  /** Timestamp da última atualização */
  updatedAt: string;
}

/**
 * Grupo de usuários que competem e colaboram juntos.
 */
export interface Group {
  /** UUID do grupo */
  id: string;
  /** Nome público do grupo */
  name: string;
  /** Descrição opcional do grupo */
  description: string | null;
  /** URL da imagem de capa do grupo */
  imageUrl: string | null;
  /** UUID do usuário que criou o grupo (owner) */
  ownerId: string;
  /** Código de convite para novos membros entrarem */
  inviteCode: string;
  /** Timestamp de criação */
  createdAt: string;
}

/**
 * Associação entre um usuário e um grupo com seu papel/função.
 */
export interface GroupMember {
  /** UUID do grupo */
  groupId: string;
  /** UUID do usuário membro */
  userId: string;
  /** Papel do usuário dentro do grupo */
  role: MemberRole;
  /** Timestamp de quando o usuário entrou no grupo */
  joinedAt: string;
  /** Dados do usuário (populado em joins) */
  user?: Pick<User, 'id' | 'username' | 'avatarUrl' | 'level' | 'totalPoints'>;
}

/**
 * Conquista que pode ser desbloqueada por um usuário ao atingir determinados marcos.
 */
export interface Achievement {
  /** UUID da conquista */
  id: string;
  /** Nome da conquista exibido na UI */
  name: string;
  /** Descrição dos critérios para desbloquear */
  description: string;
  /** Ícone representativo (nome de emoji ou chave de ativo) */
  icon: string;
  /** Pontos concedidos ao desbloquear */
  rewardPoints: number;
  /** Timestamp de criação */
  createdAt: string;
}

/**
 * Registro de uma conquista desbloqueada por um usuário específico.
 */
export interface UserAchievement {
  /** UUID do usuário */
  userId: string;
  /** UUID da conquista desbloqueada */
  achievementId: string;
  /** Timestamp de quando foi desbloqueada */
  earnedAt: string;
  /** Dados da conquista (populado em joins) */
  achievement?: Achievement;
}

/**
 * Missão com objetivo e recompensa, podendo ser individual ou em grupo.
 */
export interface Mission {
  /** UUID da missão */
  id: string;
  /** Título da missão */
  title: string;
  /** Descrição e objetivo da missão */
  description: string;
  /** Tipo da missão: individual ou em grupo */
  type: MissionType;
  /** UUID do grupo ao qual a missão está vinculada (nulo se individual) */
  groupId: string | null;
  /** Meta numérica a ser atingida (ex: número de tarefas) */
  targetValue: number;
  /** Progresso atual do usuário ou grupo na missão */
  currentValue: number;
  /** Pontos concedidos ao concluir a missão */
  rewardPoints: number;
  /** Data limite para concluir a missão (ISO 8601) */
  expiresAt: string | null;
  /** Indica se a missão já foi concluída */
  isCompleted: boolean;
  /** Timestamp de criação */
  createdAt: string;
}

/**
 * Registro imutável de uma movimentação de pontos de um usuário.
 * Serve como ledger auditável de toda a economia de gamificação.
 */
export interface PointTransaction {
  /** UUID da transação */
  id: string;
  /** UUID do usuário que recebeu ou perdeu os pontos */
  userId: string;
  /** Quantidade de pontos (positivo = ganho, negativo = perda) */
  amount: number;
  /** Motivo da transação */
  reason: PointReason;
  /** Referência à entidade que originou a transação (ex: UUID da tarefa) */
  referenceId: string | null;
  /** Timestamp da transação */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// DTOs e tipos auxiliares
// ---------------------------------------------------------------------------

/**
 * Recompensa concedida ao atingir um nível marco de gamificação.
 * Populada pela tabela level_rewards; concedida automaticamente por checkLevelUp().
 */
export interface LevelReward {
  /** Nível que concede a recompensa */
  level: number;
  /** Pontos bônus concedidos ao atingir o nível */
  bonusPoints: number;
  /** Freezes de streak concedidos ao atingir o nível */
  bonusFreezes: number;
  /** Chave do badge cosmético (null se não há badge para este nível) */
  badgeKey: string | null;
  /** Descrição da recompensa exibida na UI */
  description: string;
}

// ---------------------------------------------------------------------------
// Mecânica 1 — Perfis comportamentais
// ---------------------------------------------------------------------------

/** Tipo de perfil comportamental baseado no horário de pico de produtividade */
export enum BehavioralProfileType {
  EarlyBird = 'madrugador',
  Morning   = 'matutino',
  Afternoon = 'vespertino',
  Evening   = 'noturno',
  NightOwl  = 'coruja',
  Undefined = 'indefinido',
}

/** Características comportamentais adicionais do usuário */
export type BehavioralTag =
  | 'consistente'
  | 'procrastinador'
  | 'intenso'
  | 'metódico'
  | 'iniciante';

/** Perfil comportamental calculado a partir do histórico de tarefas */
export interface BehavioralProfile {
  type:          BehavioralProfileType;
  tags:          BehavioralTag[];
  peakHour:      number | null;
  totalAnalyzed: number;
  computedAt:    string;
}

// ---------------------------------------------------------------------------
// Mecânica 7 — Sugestões de tarefas
// ---------------------------------------------------------------------------

/** Sugestão de tarefa baseada no perfil e estado atual */
export interface TaskSuggestion {
  task:   Task;
  reason: string;
  score:  number;
}

// ---------------------------------------------------------------------------
// Mecânica 10 — Detecção de procrastinação
// ---------------------------------------------------------------------------

export type ProcrastinationAlertType = 'stale' | 'overdue' | 'cluster';
export type AlertSeverity            = 'warning' | 'critical';

/** Alerta de procrastinação gerado automaticamente */
export interface ProcrastinationAlert {
  type:       ProcrastinationAlertType;
  severity:   AlertSeverity;
  message:    string;
  taskIds:    string[];
  taskTitles: string[];
}

/** Entrada no ranking de um grupo ou global */
export interface RankingEntry {
  /** Posição no ranking */
  position: number;
  /** Dados parciais do usuário */
  user: Pick<User, 'id' | 'username' | 'avatarUrl' | 'level'>;
  /** Pontuação utilizada no critério de ranking */
  score: number;
  /** Streak atual do usuário */
  currentStreak: number;
}

// ---------------------------------------------------------------------------
// Autenticação de dois fatores (MFA/TOTP via Supabase Auth)
// ---------------------------------------------------------------------------

/**
 * Nível de garantia do autenticador (Authenticator Assurance Level) da sessão.
 * Gravado na claim `aal` do JWT emitido pelo Supabase Auth.
 */
export enum AssuranceLevel {
  /** Login convencional (e-mail + senha) — apenas um fator verificado */
  AAL1 = 'aal1',
  /** Segundo fator (TOTP) verificado nesta sessão */
  AAL2 = 'aal2',
}

/** Status de verificação de um fator MFA cadastrado */
export enum MFAFactorStatus {
  /** Fator confirmado — participa do cálculo de AAL2 */
  Verified = 'verified',
  /** Fator criado via enroll() mas ainda não confirmado com um código válido */
  Unverified = 'unverified',
}

/** Fator MFA do tipo TOTP associado ao usuário */
export interface MFAFactor {
  /** ID do fator, usado em challenge()/verify()/unenroll() */
  id: string;
  /** Nome amigável do fator (ex: "ProdScore") */
  friendlyName: string | null;
  /** Status de verificação do fator */
  status: MFAFactorStatus;
  /** Timestamp de criação do fator */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Consentimento de cookies (LGPD — Lei nº 13.709/2018)
// ---------------------------------------------------------------------------

/**
 * Categoria de cookie/rastreamento para consentimento granular.
 * `Essential` nunca exige consentimento; as demais começam desligadas.
 */
export enum CookieCategory {
  /** Necessários ao funcionamento básico (sessão, segurança) — sempre ativos */
  Essential = 'essential',
  /** Métricas de uso e desempenho (ex: analytics de produto) */
  Analytics = 'analytics',
  /** Preferências que melhoram a experiência (ex: layout, recomendações) */
  Functional = 'functional',
  /** Publicidade e rastreamento entre sites/terceiros */
  Marketing = 'marketing',
}

/** Estado de consentimento por categoria — `true` = permitido */
export type ConsentState = Record<CookieCategory, boolean>;

/**
 * Registro de consentimento com metadados de prestação de contas (accountability),
 * exigidos pela LGPD para comprovar quando e o quê o usuário consentiu.
 */
export interface ConsentRecord {
  /** Escolha do usuário por categoria */
  consent: ConsentState;
  /** Versão da política de consentimento vigente no momento da escolha */
  version: string;
  /** Timestamp ISO 8601 de quando o consentimento foi registrado */
  consentedAt: string;
}
