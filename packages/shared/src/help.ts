/**
 * Conteúdo da página de Ajuda (web e mobile), em linguagem simples.
 *
 * REGRA: nenhum número de regra é escrito à mão aqui. Pontos, bônus,
 * multiplicadores, faixas de atraso, níveis, marcos de sequência, meta semanal,
 * retomada e pesos do ranking vêm das constantes e funções que o próprio
 * sistema usa. Se uma regra mudar, o texto muda junto.
 *
 * O que vem do banco (recompensas de nível e conquistas) não está aqui: são
 * blocos dinâmicos (`levelRewards`, `achievements`) que cada plataforma
 * preenche com os dados da API. A calculadora também é um bloco
 * (`calculator`), desenhado por cada plataforma com `taskPointsBreakdown`.
 */

import { TaskDifficulty, TaskPriority } from './types/index.js';
import {
  POINTS_BY_DIFFICULTY, PRIORITY_MULTIPLIERS, ON_TIME_BONUS_MULTIPLIER,
  LATE_PENALTY_TIERS, MIN_TASK_POINTS, STREAK_MILESTONES, STREAK_MILESTONE_BONUS,
  FREEZE_PER_MILESTONE, FREEZE_STREAK_INTERVAL, FREEZE_COST_POINTS, FREEZE_MAX_BALANCE,
  RANKING_SCORE_WEIGHTS, RANKING_GLOBAL_REFRESH_MINUTES,
  pointsAtLevelStart, calculateTaskPoints,
  type TaskDelivery, type TaskPointsBreakdown,
} from './constants/gamification.js';
import {
  WEEKLY_GOAL_HISTORY_WEEKS, WEEKLY_GOAL_MIN_HISTORY_WEEKS, WEEKLY_GOAL_DEFAULT_TARGET,
  WEEKLY_GOAL_MIN_TARGET, WEEKLY_GOAL_FACTOR_DEFAULT, WEEKLY_GOAL_FACTOR_CHALLENGE,
  WEEKLY_GOAL_FACTOR_RECOVERY, WEEKLY_GOAL_FACTOR_CAP, WEEKLY_GOAL_CHALLENGE_STREAK,
  WEEKLY_GOAL_POINTS_PER_TASK, COMEBACK_INACTIVITY_DAYS, COMEBACK_BONUS_MULTIPLIER,
  COMEBACK_COOLDOWN_DAYS,
} from './constants/adaptive.js';
import { utcMidnightLocalTime } from './dates.js';

// ---------------------------------------------------------------------------
// Seções e âncoras
// ---------------------------------------------------------------------------

/** Âncora de cada seção — usada nos atalhos "?" (web: /ajuda#id; mobile: parâmetro da tela) */
export type HelpSectionId =
  | 'pontos' | 'calculadora' | 'niveis' | 'sequencia' | 'meta-semanal'
  | 'retomada' | 'conquistas' | 'missoes' | 'rankings' | 'duvidas';

/** Ordem das seções na página */
export const HELP_SECTION_IDS: ReadonlyArray<HelpSectionId> = [
  'pontos', 'calculadora', 'niveis', 'sequencia', 'meta-semanal',
  'retomada', 'conquistas', 'missoes', 'rankings', 'duvidas',
];

/** Rota da página no web */
export const HELP_PATH = '/ajuda';

/** Link web para uma seção (ex: /ajuda#sequencia) */
export function helpHref(section: HelpSectionId): string {
  return `${HELP_PATH}#${section}`;
}

/** Converte o "#hash" da URL numa seção válida, ou null */
export function helpSectionFromHash(hash: string): HelpSectionId | null {
  const id = hash.replace(/^#/, '');
  return (HELP_SECTION_IDS as ReadonlyArray<string>).includes(id) ? (id as HelpSectionId) : null;
}

// ---------------------------------------------------------------------------
// Rótulos e formatação
// ---------------------------------------------------------------------------

export const DIFFICULTY_NAMES: Record<TaskDifficulty, string> = {
  [TaskDifficulty.Easy]:   'Fácil',
  [TaskDifficulty.Medium]: 'Médio',
  [TaskDifficulty.Hard]:   'Difícil',
  [TaskDifficulty.Epic]:   'Épico',
};

export const PRIORITY_NAMES: Record<TaskPriority, string> = {
  [TaskPriority.Low]:    'Baixa',
  [TaskPriority.Medium]: 'Média',
  [TaskPriority.High]:   'Alta',
  [TaskPriority.Urgent]: 'Urgente',
};

const DIFFICULTIES: ReadonlyArray<TaskDifficulty> = [TaskDifficulty.Easy, TaskDifficulty.Medium, TaskDifficulty.Hard, TaskDifficulty.Epic];
const PRIORITIES:   ReadonlyArray<TaskPriority>   = [TaskPriority.Low, TaskPriority.Medium, TaskPriority.High, TaskPriority.Urgent];

/** 1600 → "1.600" */
export function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

/** 0.2 → "20%" */
function pct(fraction: number): string {
  return `${formatNumber(Math.round(fraction * 1000) / 10)}%`;
}

/** 1.25 → "+25%"; 0.9 → "−10%"; 1 → "sem mudança" */
function multiplierEffect(multiplier: number): string {
  const diff = Math.round((multiplier - 1) * 1000) / 1000;
  if (diff === 0) return 'sem mudança';
  return diff > 0 ? `+${pct(diff)}` : `−${pct(-diff)}`;
}

/** 1.1 → "1,1" */
function decimal(n: number): string {
  return formatNumber(Math.round(n * 100) / 100);
}

/** [3, 7, 14] → "3, 7 e 14" */
function joinList(items: ReadonlyArray<string>): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${formatNumber(n)} ${n === 1 ? singular : pluralForm}`;
}

/** Horário local "21h" / "21h30" */
function clock(hour: number, minute: number): string {
  return minute === 0 ? `${hour}h` : `${hour}h${String(minute).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Atraso e calculadora
// ---------------------------------------------------------------------------

/** "até 12 horas", "de 12 a 24 horas", "mais de 72 horas" — faixa i de LATE_PENALTY_TIERS */
function tierLabel(i: number): string {
  const tier = LATE_PENALTY_TIERS[i]!;
  const prev = i > 0 ? LATE_PENALTY_TIERS[i - 1]!.maxHours : 0;
  if (tier.maxHours === Infinity) return `mais de ${formatNumber(prev)} horas`;
  if (i === 0) return `até ${formatNumber(tier.maxHours)} horas`;
  return `de ${formatNumber(prev)} a ${formatNumber(tier.maxHours)} horas`;
}

/** Em qual faixa de atraso cai `hours` (texto curto para a calculadora) */
export function describeLateTier(hours: number): string {
  const i = LATE_PENALTY_TIERS.findIndex((t) => hours <= t.maxHours);
  const index = i === -1 ? LATE_PENALTY_TIERS.length - 1 : i;
  return `Atraso ${tierLabel(index)}: desconto de ${pct(LATE_PENALTY_TIERS[index]!.fraction)}`;
}

/**
 * Explica a conta da calculadora em palavras, ex:
 * "50 da dificuldade + 10 do bônus de prazo, × 1,25 da prioridade Urgente = 75 pontos"
 */
export function explainTaskPoints(b: TaskPointsBreakdown, priority: TaskPriority): string {
  const parts: string[] = [`${formatNumber(b.base)} da dificuldade`];
  if (b.onTimeBonus > 0) parts.push(`+ ${decimal(b.onTimeBonus)} do bônus de prazo`);
  let text = parts.join(' ');
  if (b.priorityMultiplier !== 1) text += `, × ${decimal(b.priorityMultiplier)} da prioridade ${PRIORITY_NAMES[priority]}`;
  if (b.latePenaltyFraction > 0) text += `, − ${pct(b.latePenaltyFraction)} pelo atraso`;
  return `${text} = ${plural(b.total, 'ponto', 'pontos')}`;
}

/** Opções da calculadora, na ordem dos seletores */
export const CALCULATOR_DIFFICULTIES = DIFFICULTIES;
export const CALCULATOR_PRIORITIES   = PRIORITIES;

// ---------------------------------------------------------------------------
// Conquistas: o que precisa fazer (a partir do critério gravado no banco)
// ---------------------------------------------------------------------------

/**
 * Critério da conquista em linguagem simples ("Conclua 100 tarefas").
 * O limite vem do banco (achievements.criteria); tipos desconhecidos → null,
 * e a UI mostra só a descrição da conquista.
 */
export function describeAchievementCriteria(criteria: unknown): string | null {
  if (!criteria || typeof criteria !== 'object') return null;
  const { type, threshold } = criteria as { type?: unknown; threshold?: unknown };
  if (typeof type !== 'string' || typeof threshold !== 'number') return null;
  const n = threshold;

  switch (type) {
    case 'tasks_completed':          return `Conclua ${plural(n, 'tarefa', 'tarefas')}`;
    case 'on_time_completed':        return `Conclua ${plural(n, 'tarefa', 'tarefas')} dentro do prazo`;
    case 'epic_task_completed':      return `Conclua ${plural(n, 'tarefa épica', 'tarefas épicas')}`;
    case 'streak':                   return `Chegue a uma sequência de ${plural(n, 'dia', 'dias')}`;
    case 'points_earned':            return `Junte ${plural(n, 'ponto', 'pontos')}`;
    case 'level_reached':            return `Chegue ao nível ${formatNumber(n)}`;
    case 'group_members':            return `Tenha ${plural(n, 'membro', 'membros')} em um grupo criado por você`;
    case 'group_missions_completed': return `Complete ${plural(n, 'missão de grupo', 'missões de grupo')}`;
    default:                         return null;
  }
}

// ---------------------------------------------------------------------------
// Blocos de conteúdo
// ---------------------------------------------------------------------------

export type HelpBlock =
  | { type: 'p'; text: string }
  /** Destaque (aviso importante) */
  | { type: 'note'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; head: [string, string]; rows: Array<[string, string]> }
  | { type: 'faq'; items: Array<{ q: string; a: string }> }
  /** Dinâmicos: cada plataforma desenha */
  | { type: 'calculator' }
  | { type: 'levelRewards' }
  | { type: 'achievements' };

export interface HelpSection {
  id:      HelpSectionId;
  title:   string;
  /** Resumo de uma linha, visível com a seção fechada */
  summary: string;
  blocks:  HelpBlock[];
}

/** Quantos níveis aparecem na tabela de níveis */
export const HELP_LEVELS_SHOWN = 10;

// Entradas dos exemplos. NÃO são regras: são cenários de exemplo, e os
// resultados mostrados são sempre calculados pelas funções do sistema.
const EXAMPLE_WEEKLY_AVERAGE = 10;
/** Exemplo de atraso: no meio da terceira faixa de penalidade */
function exampleLateHours(): number {
  const a = LATE_PENALTY_TIERS[1]?.maxHours ?? 0;
  const b = LATE_PENALTY_TIERS[2]?.maxHours ?? a;
  return Number.isFinite(b) ? Math.round((a + b) / 2) : a + 1;
}

/**
 * Monta todas as seções. `now` define o fuso usado no aviso de horário
 * (o "dia do sistema" vira à meia-noite UTC).
 */
export function buildHelpSections(now: Date = new Date()): HelpSection[] {
  const onTime: TaskDelivery = { kind: 'on_time' };
  const lateHours = exampleLateHours();
  const pts = (n: number) => plural(n, 'ponto', 'pontos');

  // Aviso do horário em que o dia vira (só se não for meia-noite local)
  const rollover = utcMidnightLocalTime(now);
  const dayTurnsAtMidnight = rollover.hour === 0 && rollover.minute === 0;
  const turnTime = clock(rollover.hour, rollover.minute);
  const afterTurn = clock((rollover.hour + 1) % 24, rollover.minute);
  const dayNote = dayTurnsAtMidnight
    ? null
    : `Atenção ao horário: para a sequência, a meta semanal e o ranking semanal, o dia vira às ${turnTime} no seu horário, e não à meia-noite. ${rollover.previousDay
      ? `Uma tarefa concluída às ${afterTurn} já conta para o dia seguinte.`
      : `Uma tarefa concluída às ${clock(Math.max(0, rollover.hour - 1), rollover.minute)} ainda conta para o dia anterior.`}`;

  // "no domingo às 21h, no seu horário" / "na segunda-feira à meia-noite"
  const weekStart = rollover.previousDay
    ? `no domingo às ${turnTime}, no seu horário`
    : dayTurnsAtMidnight ? 'na segunda-feira à meia-noite' : `na segunda-feira às ${turnTime}, no seu horário`;

  const exampleGoal = Math.max(WEEKLY_GOAL_MIN_TARGET, Math.ceil(EXAMPLE_WEEKLY_AVERAGE * WEEKLY_GOAL_FACTOR_DEFAULT));
  const w = RANKING_SCORE_WEIGHTS;

  return [
    // ── 1. Pontos ──────────────────────────────────────────────────────────
    {
      id: 'pontos',
      title: 'Como ganhar pontos',
      summary: 'Quanto vale cada tarefa',
      blocks: [
        { type: 'p', text: 'Cada tarefa concluída vale pontos. O valor depende de três coisas: o quanto ela é difícil, a prioridade que você deu e se você entregou no prazo.' },
        {
          type: 'table', head: ['Dificuldade', 'Pontos'],
          rows: DIFFICULTIES.map((d) => [DIFFICULTY_NAMES[d], pts(POINTS_BY_DIFFICULTY[d])]),
        },
        { type: 'p', text: `Entregou no prazo? Você ganha mais ${pct(ON_TIME_BONUS_MULTIPLIER)} em cima dos pontos da dificuldade.` },
        { type: 'p', text: 'A prioridade aumenta ou diminui um pouco o valor da tarefa:' },
        {
          type: 'table', head: ['Prioridade', 'Efeito nos pontos'],
          rows: PRIORITIES.map((p) => [PRIORITY_NAMES[p], multiplierEffect(PRIORITY_MULTIPLIERS[p])]),
        },
        { type: 'p', text: 'Atrasou? A tarefa ainda vale pontos, mas perde uma parte. Quanto maior o atraso, maior o desconto:' },
        {
          type: 'table', head: ['Atraso', 'Desconto'],
          rows: LATE_PENALTY_TIERS.map((t, i) => [capitalize(tierLabel(i)), `−${pct(t.fraction)}`]),
        },
        { type: 'note', text: `Concluir sempre vale a pena: mesmo com muito atraso, a tarefa vale pelo menos ${pts(MIN_TASK_POINTS)}.` },
        { type: 'heading', text: 'Exemplos' },
        {
          type: 'list',
          items: [
            `Tarefa difícil, prioridade média, entregue no prazo: ${pts(calculateTaskPoints(TaskDifficulty.Hard, TaskPriority.Medium, onTime))}.`,
            `A mesma tarefa difícil, mas marcada como urgente: ${pts(calculateTaskPoints(TaskDifficulty.Hard, TaskPriority.Urgent, onTime))}.`,
            `Tarefa média, prioridade média, entregue com ${formatNumber(lateHours)} horas de atraso: ${pts(calculateTaskPoints(TaskDifficulty.Medium, TaskPriority.Medium, { kind: 'late', hoursLate: lateHours }))}.`,
          ],
        },
      ],
    },

    // ── 2. Calculadora ─────────────────────────────────────────────────────
    {
      id: 'calculadora',
      title: 'Calculadora de pontos',
      summary: 'Simule quanto uma tarefa vale',
      blocks: [
        { type: 'p', text: 'Escolha as opções e veja quantos pontos a tarefa vale. A conta é a mesma que o ProdScore faz quando você conclui uma tarefa.' },
        { type: 'calculator' },
      ],
    },

    // ── 3. Níveis ──────────────────────────────────────────────────────────
    {
      id: 'niveis',
      title: 'Níveis',
      summary: 'Quantos pontos cada nível pede',
      blocks: [
        { type: 'p', text: 'Seus pontos acumulados definem o seu nível. Cada nível pede mais pontos que o anterior, então subir fica um pouco mais difícil a cada vez.' },
        {
          type: 'table', head: ['Nível', 'Pontos acumulados'],
          rows: Array.from({ length: HELP_LEVELS_SHOWN }, (_, i) => [`Nível ${i + 1}`, formatNumber(pointsAtLevelStart(i + 1))]),
        },
        { type: 'heading', text: 'Recompensas de nível' },
        { type: 'p', text: 'Alguns níveis dão presentes quando você chega neles:' },
        { type: 'levelRewards' },
      ],
    },

    // ── 4. Sequência e freeze ──────────────────────────────────────────────
    {
      id: 'sequencia',
      title: 'Sequência de dias e freeze',
      summary: 'Dias seguidos concluindo tarefas',
      blocks: [
        { type: 'p', text: 'A sequência conta quantos dias seguidos você concluiu pelo menos uma tarefa. Concluiu uma tarefa hoje? A sequência sobe. Passou um dia inteiro sem concluir nenhuma? Ela volta para o começo.' },
        ...(dayNote ? [{ type: 'note', text: dayNote } as HelpBlock] : []),
        {
          type: 'p',
          text: `Marcos: ao chegar em ${joinList(STREAK_MILESTONES.map((m) => formatNumber(m)))} dias seguidos, você ganha +${pts(STREAK_MILESTONE_BONUS)} de bônus e ${plural(FREEZE_PER_MILESTONE, 'freeze', 'freezes')}.`,
        },
        { type: 'heading', text: 'Freeze: a proteção da sequência' },
        { type: 'p', text: 'O freeze protege sua sequência num dia em que você não conseguir concluir nada. Cada freeze cobre um dia.' },
        {
          type: 'list',
          items: [
            `Você ganha um freeze a cada ${plural(FREEZE_STREAK_INTERVAL, 'dia seguido', 'dias seguidos')} de sequência.`,
            'Alguns níveis dão freezes de presente (veja em Níveis).',
            `Também dá para comprar um freeze por ${pts(FREEZE_COST_POINTS)}.`,
            `Você pode guardar no máximo ${plural(FREEZE_MAX_BALANCE, 'freeze', 'freezes')}.`,
          ],
        },
        { type: 'note', text: 'Importante: o freeze só protege se você ATIVAR antes do dia que vai perder. Ativar depois não recupera a sequência. Vai viajar ou sabe que vai ficar sem tempo? Ative antes.' },
      ],
    },

    // ── 5. Meta semanal ────────────────────────────────────────────────────
    {
      id: 'meta-semanal',
      title: 'Meta semanal',
      summary: 'Uma meta que se adapta ao seu ritmo',
      blocks: [
        { type: 'p', text: `Toda semana você tem uma meta de tarefas para concluir. Ela é calculada a partir da sua média de tarefas concluídas nas últimas ${plural(WEEKLY_GOAL_HISTORY_WEEKS, 'semana', 'semanas')}, com um pequeno desafio a mais (${multiplierEffect(WEEKLY_GOAL_FACTOR_DEFAULT)}).` },
        { type: 'p', text: `Por exemplo: se a sua média é de ${plural(EXAMPLE_WEEKLY_AVERAGE, 'tarefa', 'tarefas')} por semana, a meta fica em ${plural(exampleGoal, 'tarefa', 'tarefas')}.` },
        { type: 'heading', text: 'Por que a meta muda de uma semana para outra' },
        {
          type: 'list',
          items: [
            `Bateu as ${formatNumber(WEEKLY_GOAL_CHALLENGE_STREAK)} últimas metas? O desafio sobe para ${multiplierEffect(WEEKLY_GOAL_FACTOR_CHALLENGE)}.`,
            `Não bateu a meta da semana passada? A meta fica ${WEEKLY_GOAL_FACTOR_RECOVERY === 1 ? 'igual à sua média, sem acréscimo' : `com ${multiplierEffect(WEEKLY_GOAL_FACTOR_RECOVERY)}`}, para ficar mais alcançável.`,
            `Quem está começando ou anda com dificuldade de manter o ritmo recebe um desafio mais leve (no máximo ${multiplierEffect(WEEKLY_GOAL_FACTOR_CAP)}).`,
            `Nas primeiras ${plural(WEEKLY_GOAL_MIN_HISTORY_WEEKS, 'semana', 'semanas')} de conta, a meta é de ${plural(WEEKLY_GOAL_DEFAULT_TARGET, 'tarefa', 'tarefas')}, enquanto o ProdScore conhece o seu ritmo.`,
            `A meta nunca fica abaixo de ${plural(WEEKLY_GOAL_MIN_TARGET, 'tarefa', 'tarefas')}.`,
          ],
        },
        { type: 'p', text: `Bateu a meta? Você ganha ${pts(WEEKLY_GOAL_POINTS_PER_TASK)} para cada tarefa da meta (uma meta de ${plural(exampleGoal, 'tarefa', 'tarefas')} vale ${pts(exampleGoal * WEEKLY_GOAL_POINTS_PER_TASK)}).` },
        { type: 'p', text: `A semana começa ${weekStart}.` },
      ],
    },

    // ── 6. Retomada ────────────────────────────────────────────────────────
    {
      id: 'retomada',
      title: 'Bônus de retomada',
      summary: 'Um empurrão para quem volta',
      blocks: [
        { type: 'p', text: `Ficou ${plural(COMEBACK_INACTIVITY_DAYS, 'dia', 'dias')} ou mais sem concluir tarefas? A primeira tarefa que você concluir na volta vale ${multiplierEffect(1 + COMEBACK_BONUS_MULTIPLIER)} de pontos.` },
        { type: 'note', text: `Esse bônus aparece no máximo uma vez a cada ${plural(COMEBACK_COOLDOWN_DAYS, 'dia', 'dias')}.` },
      ],
    },

    // ── 7. Conquistas ──────────────────────────────────────────────────────
    {
      id: 'conquistas',
      title: 'Conquistas',
      summary: 'Medalhas por marcos especiais',
      blocks: [
        { type: 'p', text: 'Conquistas são medalhas que você ganha ao chegar em marcos especiais. A maioria também dá pontos extras na hora em que é desbloqueada.' },
        { type: 'achievements' },
      ],
    },

    // ── 8. Grupos e missões ────────────────────────────────────────────────
    {
      id: 'missoes',
      title: 'Grupos e missões',
      summary: 'Metas em equipe',
      blocks: [
        { type: 'p', text: 'Nos grupos, vocês podem ter missões: metas coletivas, como "concluir um certo número de tarefas até uma data".' },
        {
          type: 'list',
          items: [
            'As tarefas de todos os membros que participam da missão somam no mesmo contador.',
            'Quando o grupo chega na meta, TODOS os membros ganham a recompensa, inclusive quem ainda não tinha contribuído.',
            'Algumas missões têm prazo: se ele acabar antes de o grupo chegar na meta, a recompensa não sai.',
          ],
        },
      ],
    },

    // ── 9. Rankings ────────────────────────────────────────────────────────
    {
      id: 'rankings',
      title: 'Rankings',
      summary: 'Como as posições são calculadas',
      blocks: [
        { type: 'p', text: 'Existem quatro rankings:' },
        {
          type: 'table', head: ['Ranking', 'O que considera'],
          rows: [
            ['Global', `Todo mundo do ProdScore, com uma nota que mistura três coisas (veja abaixo). Atualizado a cada ${plural(RANKING_GLOBAL_REFRESH_MINUTES, 'minuto', 'minutos')}.`],
            ['Semanal', `Só os pontos ganhos nesta semana. Recomeça toda semana, ${weekStart}.`],
            ['Amigos', `A mesma nota do global, só entre você e seus amigos. Também atualiza a cada ${plural(RANKING_GLOBAL_REFRESH_MINUTES, 'minuto', 'minutos')}.`],
            ['Grupo', 'A mesma nota do global, só entre os membros do grupo. Calculado na hora.'],
          ],
        },
        { type: 'heading', text: 'Como a nota é calculada' },
        {
          type: 'list',
          items: [
            `${pct(w.points)} do peso vem dos seus pontos totais.`,
            `${pct(w.streak)} vem da sua sequência de dias (cada dia de sequência conta como ${pts(w.streakDayValue)} nessa conta).`,
            `${pct(w.consistency)} vem da sua constância: de todas as tarefas que você criou, quantas você concluiu.`,
          ],
        },
        { type: 'p', text: 'Ou seja: além de juntar pontos, manter a sequência e concluir o que você cria também te ajudam a subir.' },
      ],
    },

    // ── 10. Perguntas frequentes ───────────────────────────────────────────
    {
      id: 'duvidas',
      title: 'Perguntas frequentes',
      summary: 'Respostas rápidas',
      blocks: [
        {
          type: 'faq',
          items: [
            {
              q: 'Por que perdi minha sequência?',
              a: `Passou um dia inteiro sem nenhuma tarefa concluída e não havia um freeze ATIVADO antes. ${dayNote ? `Lembre também que o dia vira às ${turnTime} no seu horário.` : ''}`.trim(),
            },
            {
              q: 'Por que minha meta desta semana é diferente da semana passada?',
              a: 'A meta acompanha o seu ritmo: ela usa a sua média recente, sobe quando você bate metas seguidas e fica mais leve quando você não consegue bater.',
            },
            {
              q: 'Por que ganhei menos pontos do que esperava?',
              a: 'Provavelmente a tarefa foi entregue com atraso (cada faixa de atraso tira uma parte dos pontos) ou estava com prioridade baixa. Use a calculadora para conferir.',
            },
            {
              q: 'Por que minha posição no ranking global não mudou na hora?',
              a: `O ranking global e o de amigos são recalculados a cada ${plural(RANKING_GLOBAL_REFRESH_MINUTES, 'minuto', 'minutos')}. Seus pontos entram na hora, mas a posição pode demorar um pouquinho para aparecer.`,
            },
            ...(dayNote ? [{
              q: 'Por que minha tarefa contou para outro dia?',
              a: `Para o ProdScore, o dia vira às ${turnTime} no seu horário. O que você conclui depois disso já conta para o dia seguinte.`,
            }] : []),
          ],
        },
      ],
    },
  ];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
