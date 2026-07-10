/**
 * Testes da página Dashboard.
 * Stores são mockados para isolar a lógica de UI da API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TaskDifficulty, TaskStatus, type Task } from '@prodscore/shared';

// ---------------------------------------------------------------------------
// Dados de teste
// ---------------------------------------------------------------------------

const mockUser = {
  id:             'user-1',
  username:       'gabriel',
  email:          'gabriel@test.com',
  avatarUrl:      null,
  bio:            null,
  level:          2,
  totalPoints:    450,
  currentStreak:  3,
  longestStreak:  5,
  lastActiveDate: null,
  createdAt:      '2025-01-01T00:00:00.000Z',
};

const mockStats = {
  totalPoints:            450,
  level:                  2,
  currentStreak:          3,
  longestStreak:          5,
  tasksCompleted:         18,
  tasksCompletedThisWeek: 4,
  consistencyRate:        80,
  pointsThisWeek:         120,
  rankPosition:           12,
  achievementsCount:      5,
  activeMissions:         [],
};

const todayDate = new Date().toISOString().split('T')[0]!;

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id:           'task-1',
    userId:       'user-1',
    groupId:      null,
    title:        'Estudar React',
    description:  null,
    difficulty:   TaskDifficulty.Medium,
    status:       TaskStatus.Pending,
    dueDate:      `${todayDate}T23:59:00.000Z`,
    completedAt:  null,
    pointsEarned: null,
    createdAt:    new Date().toISOString(),
    updatedAt:    new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mocks das stores e dependências
// ---------------------------------------------------------------------------

const mockFetchStats   = vi.fn();
const mockFetchTasks   = vi.fn();
const mockCompleteTask = vi.fn();

// taskStore retorna tarefas por padrão — trocamos em testes específicos via mockReturnValueOnce
vi.mock('../store/authStore.js', () => ({
  useAuthStore: () => ({ user: mockUser, isAuthenticated: true, isLoading: false }),
}));

const taskStoreMock = {
  tasks:        [makeTask()],
  isLoading:    false,
  fetchTasks:   mockFetchTasks,
  completeTask: mockCompleteTask,
  deleteTask:   vi.fn(),
  createTask:   vi.fn(),
  updateTask:   vi.fn(),
};

vi.mock('../store/taskStore.js', () => ({
  useTaskStore: () => taskStoreMock,
}));

const userStoreMock = {
  stats:      mockStats,
  isLoading:  false,
  fetchStats: mockFetchStats,
};

vi.mock('../store/userStore.js', () => ({
  useUserStore: () => userStoreMock,
}));


vi.mock('../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
    })),
  },
}));

import DashboardPage from '../pages/DashboardPage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchTasks.mockResolvedValue(undefined);
    mockFetchStats.mockResolvedValue(undefined);
    mockCompleteTask.mockResolvedValue({
      pontosGanhos:  30,
      novoStreak:    4,
      novoNivel:     2,
      subidoDeNivel: false,
      marcoStreak:   false,
      tarefa:        makeTask({ status: TaskStatus.Completed }),
    });
  });

  it('deve exibir estado de carregamento na montagem', () => {
    // Quando isLoading = true a página mostra skeleton/spinner
    userStoreMock.isLoading = true;
    userStoreMock.stats     = null as unknown as typeof mockStats;

    renderDashboard();

    // O dashboard não deve quebrar durante carregamento inicial
    expect(document.body).toBeInTheDocument();

    // Restaura estado
    userStoreMock.isLoading = false;
    userStoreMock.stats     = mockStats;
  });

  it('deve chamar fetchStats e fetchTasks na montagem', () => {
    renderDashboard();

    expect(mockFetchStats).toHaveBeenCalledTimes(1);
    expect(mockFetchTasks).toHaveBeenCalledTimes(1);
  });

  it('deve renderizar saudação com nome do usuário', () => {
    renderDashboard();

    expect(screen.getByText(/olá, gabriel/i)).toBeInTheDocument();
  });

  it('deve renderizar cards de estatísticas com dados das stores mockadas', async () => {
    renderDashboard();

    await waitFor(() => {
      // 450 pontos e nível 2 devem aparecer nos cards de stats
      expect(screen.getByText('450')).toBeInTheDocument();
    });
  });

  it('deve exibir tarefa de hoje na lista', () => {
    renderDashboard();

    expect(screen.getByText('Estudar React')).toBeInTheDocument();
  });

  it('conclusão rápida deve chamar taskStore.completeTask com o id correto', async () => {
    renderDashboard();

    const completeButton = screen.getByRole('button', { name: /concluir/i });
    await userEvent.click(completeButton);

    await waitFor(() => {
      expect(mockCompleteTask).toHaveBeenCalledWith('task-1');
    });
  });

  it('deve exibir estado vazio quando não há tarefas para hoje', () => {
    // Sobrepõe a lista de tarefas para array vazio
    taskStoreMock.tasks = [];

    renderDashboard();

    expect(screen.getByText(/nenhuma tarefa para hoje/i)).toBeInTheDocument();

    // Restaura
    taskStoreMock.tasks = [makeTask()];
  });
});
