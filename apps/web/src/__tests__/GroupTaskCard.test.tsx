/**
 * Card de tarefa na aba Tarefas do grupo: todos os membros veem as tarefas
 * de todos, com quem criou; só o dono vê o botão de concluir.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TaskDifficulty, TaskPriority, TaskStatus, type Task } from '@prodscore/shared';

vi.mock('../store/authStore.js', () => ({
  useAuthStore: (selector: (s: object) => unknown) => selector({ user: { id: 'eu' } }),
}));
vi.mock('../lib/supabase.js', () => ({ supabase: {} }));

import { GroupTaskCard } from '../pages/GroupDetailPage';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1', userId: 'eu', groupId: 'g1', title: 'Revisar capítulo 3',
    description: null, descriptionRich: null, difficulty: TaskDifficulty.Medium,
    status: TaskStatus.Pending, priority: TaskPriority.Medium, estimatedMinutes: null,
    overdueSince: null, dueDate: null, completedAt: null, pointsEarned: null,
    createdAt: '', updatedAt: '', requiresProof: false, hasProof: false,
    ...overrides,
  };
}

const renderCard = (task: Task) => render(<MemoryRouter><GroupTaskCard task={task} onComplete={vi.fn()} /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('GroupTaskCard', () => {
  it('tarefa minha: mostra "por você" e o botão de concluir', () => {
    renderCard(makeTask());
    expect(screen.getByText('por você')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Concluir Revisar capítulo 3' })).toBeInTheDocument();
  });

  it('tarefa de outro membro: aparece com o autor, mas sem botão de concluir', () => {
    renderCard(makeTask({ userId: 'ana', author: { id: 'ana', username: 'ana_souza', avatarUrl: null } }));
    expect(screen.getByText('Revisar capítulo 3')).toBeInTheDocument();
    expect(screen.getByText('por @ana_souza')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Concluir/ })).not.toBeInTheDocument();
  });
});
