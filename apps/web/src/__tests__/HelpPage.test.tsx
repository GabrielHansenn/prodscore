/**
 * Página de Ajuda: a calculadora mostra exatamente o valor da função de
 * cálculo do sistema, e os atalhos "?" abrem a seção certa.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  TaskDifficulty, TaskPriority, calculateTaskPoints, buildHelpSections, HELP_SECTION_IDS,
  DIFFICULTY_NAMES, PRIORITY_NAMES, type HelpSectionId,
} from '@prodscore/shared';

const { mockGetAchievements, mockGetUserAchievements, mockGetLevelRewards } = vi.hoisted(() => ({
  mockGetAchievements:     vi.fn(),
  mockGetUserAchievements: vi.fn(),
  mockGetLevelRewards:     vi.fn(),
}));

vi.mock('../services/achievement.service.js', () => ({
  getAchievements:     mockGetAchievements,
  getUserAchievements: mockGetUserAchievements,
  getLevelRewards:     mockGetLevelRewards,
}));

import HelpPage from '../pages/HelpPage';
import HelpCalculator from '../components/help/HelpCalculator';
import { HelpLink } from '../components/HelpLink';

const SECTION_TITLES = Object.fromEntries(buildHelpSections().map((s) => [s.id, s.title])) as Record<HelpSectionId, string>;

function renderHelp(path = '/ajuda') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/ajuda" element={<HelpPage />} />
        <Route path="*" element={<HelpLink section="sequencia" topic="sequência" />} />
      </Routes>
    </MemoryRouter>,
  );
}

const sectionButton = (id: HelpSectionId) => screen.getByRole('button', { name: new RegExp(SECTION_TITLES[id]) });

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  mockGetLevelRewards.mockResolvedValue([
    { level: 5, bonusPoints: 50, bonusFreezes: 1, badgeKey: 'rocket', description: 'Foguete' },
  ]);
  mockGetAchievements.mockResolvedValue([
    { id: 'a1', name: 'Centena', description: 'x', icon: 'medal', rewardPoints: 200, criteria: { type: 'tasks_completed', threshold: 100 }, createdAt: '' },
    { id: 'a2', name: 'Primeiros Passos', description: 'x', icon: 'star', rewardPoints: 10, criteria: { type: 'tasks_completed', threshold: 1 }, createdAt: '' },
  ]);
  mockGetUserAchievements.mockResolvedValue([{ id: 'a2', earnedAt: '' }]);
});

// ---------------------------------------------------------------------------

describe('Calculadora de pontos', () => {
  async function choose(group: string, option: string) {
    await userEvent.click(within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: option }));
  }

  const result = () => screen.getByTestId('calc-result').textContent;

  it.each([
    [TaskDifficulty.Easy,   TaskPriority.Low,    null],
    [TaskDifficulty.Hard,   TaskPriority.Medium, null],
    [TaskDifficulty.Hard,   TaskPriority.Urgent, null],
    [TaskDifficulty.Epic,   TaskPriority.High,   null],
    [TaskDifficulty.Medium, TaskPriority.Medium, 5],
    [TaskDifficulty.Medium, TaskPriority.High,   30],
    [TaskDifficulty.Hard,   TaskPriority.Urgent, 60],
    [TaskDifficulty.Easy,   TaskPriority.Low,    500],
  ] as const)('%s / %s / atraso %s h → mesmo valor de calculateTaskPoints', async (difficulty, priority, hoursLate) => {
    render(<HelpCalculator />);
    await choose('Dificuldade', DIFFICULTY_NAMES[difficulty]);
    await choose('Prioridade', PRIORITY_NAMES[priority]);

    let expected: number;
    if (hoursLate === null) {
      expected = calculateTaskPoints(difficulty, priority, { kind: 'on_time' });
    } else {
      await choose('Entrega', 'Com atraso');
      const input = screen.getByLabelText('Quantas horas de atraso?');
      await userEvent.clear(input);
      await userEvent.type(input, String(hoursLate));
      expected = calculateTaskPoints(difficulty, priority, { kind: 'late', hoursLate });
    }

    expect(result()).toBe(`${expected.toLocaleString('pt-BR')} ${expected === 1 ? 'ponto' : 'pontos'}`);
  });

  it('explica a conta em palavras', async () => {
    render(<HelpCalculator />);
    await choose('Prioridade', 'Urgente');
    expect(screen.getByTestId('calc-explanation')).toHaveTextContent(/bônus de prazo.*prioridade Urgente/);
  });
});

// ---------------------------------------------------------------------------

describe('Página de Ajuda', () => {
  it('mostra as 10 seções, só a primeira aberta', () => {
    renderHelp();
    for (const id of HELP_SECTION_IDS) expect(document.getElementById(id)).not.toBeNull();
    expect(sectionButton('pontos')).toHaveAttribute('aria-expanded', 'true');
    expect(sectionButton('sequencia')).toHaveAttribute('aria-expanded', 'false');
  });

  it.each(['sequencia', 'meta-semanal', 'rankings', 'missoes'] as const)(
    'abrindo /ajuda#%s, essa seção já vem aberta e a página rola até ela',
    async (id) => {
      renderHelp(`/ajuda#${id}`);
      expect(sectionButton(id)).toHaveAttribute('aria-expanded', 'true');
      // Rolou até a própria seção (a do #hash), não até outra
      await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
      expect(vi.mocked(Element.prototype.scrollIntoView).mock.instances.at(-1)).toBe(document.getElementById(id));
    },
  );

  it('o "?" leva para a seção certa e ela abre', async () => {
    renderHelp('/dashboard');
    await userEvent.click(screen.getByRole('link', { name: 'Ajuda: sequência' }));
    expect(sectionButton('sequencia')).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicar no título abre e fecha a seção', async () => {
    renderHelp();
    await userEvent.click(sectionButton('niveis'));
    expect(sectionButton('niveis')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(sectionButton('niveis'));
    expect(sectionButton('niveis')).toHaveAttribute('aria-expanded', 'false');
  });

  it('recompensas de nível vêm da API (banco)', async () => {
    renderHelp('/ajuda#niveis');
    expect(await screen.findByText('Foguete')).toBeInTheDocument();
    expect(screen.getByText('+50 pontos e +1 freeze')).toBeInTheDocument();
  });

  it('lista todas as conquistas, marcando as que o usuário já tem', async () => {
    renderHelp('/ajuda#conquistas');
    const centena = (await screen.findByText('Centena')).closest('li')!;
    const primeiros = screen.getByText('Primeiros Passos').closest('li')!;
    expect(within(centena).getByText('Bloqueada')).toBeInTheDocument();
    expect(within(centena).getByText('Conclua 100 tarefas')).toBeInTheDocument();
    expect(within(primeiros).getByText('Você já tem')).toBeInTheDocument();
    expect(screen.getByText('Você já tem 1 de 2.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------

describe('Atalhos "?"', () => {
  it.each(['sequencia', 'meta-semanal', 'rankings', 'missoes'] as const)('HelpLink de %s aponta para /ajuda#%s', (id) => {
    render(<MemoryRouter><HelpLink section={id} topic="tema" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Ajuda: tema' })).toHaveAttribute('href', `/ajuda#${id}`);
  });
});
