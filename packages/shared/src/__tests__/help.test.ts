/**
 * Cálculo único de pontos e conteúdo da página de Ajuda.
 *
 * O ponto principal: a página não pode ter número escrito à mão — então os
 * testes conferem que os textos acompanham as constantes, e que a função de
 * pontos dá exatamente o resultado da regra que a API usava antes.
 */

import { describe, it, expect } from 'vitest';
import {
  TaskDifficulty, TaskPriority,
  POINTS_BY_DIFFICULTY, PRIORITY_MULTIPLIERS, ON_TIME_BONUS_MULTIPLIER, LATE_PENALTY_TIERS,
  RANKING_GLOBAL_REFRESH_MINUTES, FREEZE_COST_POINTS, WEEKLY_GOAL_POINTS_PER_TASK,
  applyLatePenalty, calculateTaskPoints, taskPointsBreakdown, pointsAtLevelStart,
  buildHelpSections, HELP_SECTION_IDS, helpHref, helpSectionFromHash,
  describeAchievementCriteria, describeLateTier, explainTaskPoints, utcMidnightLocalTime,
  type HelpBlock,
} from '../index.js';

const DIFFS = Object.values(TaskDifficulty);
const PRIOS = Object.values(TaskPriority);

/** Regra antiga (calculatePoints + penalidade do completeTask), reescrita aqui como referência */
function legacyPoints(d: TaskDifficulty, p: TaskPriority, hoursLate: number | null): number {
  const base = POINTS_BY_DIFFICULTY[d];
  if (hoursLate === null) return Math.floor(base * (1 + ON_TIME_BONUS_MULTIPLIER) * PRIORITY_MULTIPLIERS[p]);
  return applyLatePenalty(Math.floor(base * PRIORITY_MULTIPLIERS[p]), hoursLate);
}

/** Todo o texto visível da página, para procurar valores */
function allText(): string {
  const parts: string[] = [];
  const add = (b: HelpBlock) => {
    if (b.type === 'p' || b.type === 'note' || b.type === 'heading') parts.push(b.text);
    if (b.type === 'list') parts.push(...b.items);
    if (b.type === 'table') parts.push(...b.head, ...b.rows.flat());
    if (b.type === 'faq') b.items.forEach((i) => parts.push(i.q, i.a));
  };
  buildHelpSections().forEach((s) => { parts.push(s.title, s.summary); s.blocks.forEach(add); });
  return parts.join('\n');
}

describe('calculateTaskPoints — fonte única do cálculo', () => {
  it('no prazo: mesmo resultado da regra anterior em todas as combinações', () => {
    for (const d of DIFFS) for (const p of PRIOS) {
      expect(calculateTaskPoints(d, p, { kind: 'on_time' })).toBe(legacyPoints(d, p, null));
    }
  });

  it('atrasada: mesmo resultado em todas as faixas de atraso', () => {
    const hours = [0, 1, ...LATE_PENALTY_TIERS.filter((t) => Number.isFinite(t.maxHours)).flatMap((t) => [t.maxHours, t.maxHours + 0.5]), 500];
    for (const d of DIFFS) for (const p of PRIOS) for (const h of hours) {
      expect(calculateTaskPoints(d, p, { kind: 'late', hoursLate: h })).toBe(legacyPoints(d, p, h));
    }
  });

  it('sem prazo (tarefas antigas): base × prioridade', () => {
    expect(calculateTaskPoints(TaskDifficulty.Hard, TaskPriority.High, { kind: 'no_deadline' }))
      .toBe(Math.floor(POINTS_BY_DIFFICULTY[TaskDifficulty.Hard] * PRIORITY_MULTIPLIERS[TaskPriority.High]));
  });

  it('nunca vale menos de 1 ponto', () => {
    expect(calculateTaskPoints(TaskDifficulty.Easy, TaskPriority.Low, { kind: 'late', hoursLate: 10_000 })).toBeGreaterThanOrEqual(1);
  });

  it('o detalhamento explica a conta e termina no total', () => {
    const b = taskPointsBreakdown(TaskDifficulty.Hard, TaskPriority.Urgent, { kind: 'on_time' });
    const text = explainTaskPoints(b, TaskPriority.Urgent);
    expect(text).toContain(`${POINTS_BY_DIFFICULTY[TaskDifficulty.Hard]} da dificuldade`);
    expect(text).toContain('bônus de prazo');
    expect(text).toContain('Urgente');
    expect(text).toMatch(new RegExp(`= ${b.total} pontos$`));
  });

  it('descreve a faixa de atraso', () => {
    expect(describeLateTier(1)).toContain(`${LATE_PENALTY_TIERS[0]!.fraction * 100}%`);
  });
});

describe('conteúdo da Ajuda', () => {
  it('tem as 10 seções, na ordem das âncoras', () => {
    expect(buildHelpSections().map((s) => s.id)).toEqual(HELP_SECTION_IDS);
  });

  it('âncoras: link e leitura do #hash', () => {
    expect(helpHref('sequencia')).toBe('/ajuda#sequencia');
    expect(helpSectionFromHash('#meta-semanal')).toBe('meta-semanal');
    expect(helpSectionFromHash('#nao-existe')).toBeNull();
  });

  it('os números do texto vêm das regras (pontos, níveis, freeze, meta, ranking)', () => {
    const text = allText();
    for (const d of DIFFS) expect(text).toContain(`${POINTS_BY_DIFFICULTY[d]} pontos`);
    expect(text).toContain(`${ON_TIME_BONUS_MULTIPLIER * 100}%`);
    expect(text).toContain(pointsAtLevelStart(5).toLocaleString('pt-BR'));
    expect(text).toContain(`${FREEZE_COST_POINTS} pontos`);
    expect(text).toContain(`${WEEKLY_GOAL_POINTS_PER_TASK} pontos`);
    expect(text).toContain(`a cada ${RANKING_GLOBAL_REFRESH_MINUTES} minutos`);
  });

  it('os exemplos usam a função de cálculo', () => {
    const exemplo = calculateTaskPoints(TaskDifficulty.Hard, TaskPriority.Medium, { kind: 'on_time' });
    expect(allText()).toContain(`Tarefa difícil, prioridade média, entregue no prazo: ${exemplo} pontos.`);
  });

  it('não sobra "undefined", "NaN" nem "Infinity" no texto', () => {
    expect(allText()).not.toMatch(/undefined|NaN|Infinity/);
  });

  it('tem os blocos dinâmicos: calculadora, recompensas de nível e conquistas', () => {
    const types = buildHelpSections().flatMap((s) => s.blocks.map((b) => b.type));
    expect(types).toEqual(expect.arrayContaining(['calculator', 'levelRewards', 'achievements']));
  });

  it('avisa o horário em que o dia vira quando ele não é meia-noite local', () => {
    const { hour, minute } = utcMidnightLocalTime();
    const text = allText();
    if (hour === 0 && minute === 0) expect(text).not.toContain('o dia vira às');
    else expect(text).toContain(`o dia vira às ${hour}h`);
  });
});

describe('describeAchievementCriteria', () => {
  it.each([
    [{ type: 'tasks_completed', threshold: 100 }, 'Conclua 100 tarefas'],
    [{ type: 'tasks_completed', threshold: 1 },   'Conclua 1 tarefa'],
    [{ type: 'streak', threshold: 7 },            'Chegue a uma sequência de 7 dias'],
    [{ type: 'level_reached', threshold: 5 },     'Chegue ao nível 5'],
    [{ type: 'points_earned', threshold: 2000 },  'Junte 2.000 pontos'],
    [{ type: 'on_time_completed', threshold: 5 }, 'Conclua 5 tarefas dentro do prazo'],
  ])('%j → %s', (criteria, text) => {
    expect(describeAchievementCriteria(criteria)).toBe(text);
  });

  it('critério desconhecido ou inválido → null (a UI usa a descrição)', () => {
    expect(describeAchievementCriteria({ type: 'outro', threshold: 1 })).toBeNull();
    expect(describeAchievementCriteria(null)).toBeNull();
  });
});
