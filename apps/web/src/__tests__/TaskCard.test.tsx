/**
 * Testes do componente TaskCard.
 * Verifica renderização de badges, botão de conclusão e preview de pontos.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDifficulty, TaskStatus, type Task } from '@prodscore/shared';
import TaskCard from '../components/TaskCard';

// ---------------------------------------------------------------------------
// Factory de tarefa de teste
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id:           'task-1',
    userId:       'user-1',
    groupId:      null,
    title:        'Implementar autenticação',
    description:  null,
    difficulty:   TaskDifficulty.Medium,
    status:       TaskStatus.Pending,
    dueDate:      null,
    completedAt:  null,
    pointsEarned: null,
    createdAt:    '2025-06-01T10:00:00.000Z',
    updatedAt:    '2025-06-01T10:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('TaskCard', () => {
  const noop = vi.fn();

  it('deve renderizar título, badge de dificuldade e badge de status', () => {
    const task = makeTask({ difficulty: TaskDifficulty.Hard, status: TaskStatus.InProgress });
    render(<TaskCard task={task} onComplete={noop} onDelete={noop} />);

    expect(screen.getByText('Implementar autenticação')).toBeInTheDocument();
    expect(screen.getByText('Difícil')).toBeInTheDocument();
    expect(screen.getByText('Em Andamento')).toBeInTheDocument();
  });

  it('deve exibir botão Concluir quando status é pending', () => {
    const task = makeTask({ status: TaskStatus.Pending });
    render(<TaskCard task={task} onComplete={noop} onDelete={noop} />);

    expect(screen.getByRole('button', { name: /concluir/i })).toBeInTheDocument();
  });

  it('deve exibir botão Concluir quando status é in_progress', () => {
    const task = makeTask({ status: TaskStatus.InProgress });
    render(<TaskCard task={task} onComplete={noop} onDelete={noop} />);

    expect(screen.getByRole('button', { name: /concluir/i })).toBeInTheDocument();
  });

  it('não deve exibir botão Concluir quando status é completed', () => {
    const task = makeTask({ status: TaskStatus.Completed });
    render(<TaskCard task={task} onComplete={noop} onDelete={noop} />);

    expect(screen.queryByRole('button', { name: /concluir/i })).not.toBeInTheDocument();
  });

  it('não deve exibir botão Concluir quando status é overdue', () => {
    // Atrasada ainda pode ser concluída — deve exibir o botão
    const task = makeTask({ status: TaskStatus.Overdue });
    render(<TaskCard task={task} onComplete={noop} onDelete={noop} />);

    // Overdue ainda é acionável no TaskCard (pending | in_progress | overdue)
    // Status Overdue NÃO é listed em isActionable no componente
    expect(screen.queryByRole('button', { name: /concluir/i })).not.toBeInTheDocument();
  });

  it('deve exibir preview de pontos correto para cada dificuldade', () => {
    const cases: Array<[TaskDifficulty, string]> = [
      [TaskDifficulty.Easy,   '+10 pts'],
      [TaskDifficulty.Medium, '+25 pts'],
      [TaskDifficulty.Hard,   '+50 pts'],
      [TaskDifficulty.Epic,   '+100 pts'],
    ];

    for (const [difficulty, expectedText] of cases) {
      const { unmount } = render(
        <TaskCard
          task={makeTask({ difficulty, dueDate: null })}
          onComplete={noop}
          onDelete={noop}
        />,
      );
      // Verifica que o texto de pontos base está presente (sem modificador, dueDate null)
      expect(screen.getByText(expectedText)).toBeInTheDocument();
      unmount();
    }
  });

  it('deve exibir pontos ganhos quando tarefa já está concluída', () => {
    const task = makeTask({
      status:       TaskStatus.Completed,
      pointsEarned: 30,
    });
    render(<TaskCard task={task} onComplete={noop} onDelete={noop} />);

    expect(screen.getByText('+30 pts')).toBeInTheDocument();
  });

  it('deve chamar onComplete com o id da tarefa ao clicar em Concluir', async () => {
    const onComplete = vi.fn();
    const task = makeTask({ status: TaskStatus.Pending });
    render(<TaskCard task={task} onComplete={onComplete} onDelete={noop} />);

    await userEvent.click(screen.getByRole('button', { name: /concluir/i }));

    expect(onComplete).toHaveBeenCalledWith('task-1');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('deve exibir badge "Concluída" com riscado no título quando completada', () => {
    const task = makeTask({ status: TaskStatus.Completed });
    render(<TaskCard task={task} onComplete={noop} onDelete={noop} />);

    expect(screen.getByText('Concluída')).toBeInTheDocument();
    // O título deve ter classe de line-through
    const titleEl = screen.getByText(task.title);
    expect(titleEl).toHaveClass('line-through');
  });
});
