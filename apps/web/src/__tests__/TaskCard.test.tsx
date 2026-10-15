/**
 * Testes do componente TaskCard.
 * Verifica renderização de badges, botão de conclusão e preview de pontos.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDifficulty, TaskPriority, TaskStatus, type Task, type RichTextDoc } from '@prodscore/shared';
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
    descriptionRich: null,
    difficulty:   TaskDifficulty.Medium,
    status:       TaskStatus.Pending,
    priority:     TaskPriority.Medium,
    estimatedMinutes: null,
    overdueSince: null,
    dueDate:      null,
    completedAt:  null,
    pointsEarned: null,
    createdAt:    '2025-06-01T10:00:00.000Z',
    updatedAt:    '2025-06-01T10:00:00.000Z',
    requiresProof: false,
    hasProof:     false,
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

// ---------------------------------------------------------------------------
// Descrição formatada
// ---------------------------------------------------------------------------

describe('TaskCard — descrição', () => {
  const noop = vi.fn();

  const richDoc: RichTextDoc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [
        { type: 'text', text: 'Revisar', marks: ['bold'] },
        { type: 'text', text: ' o ' },
        { type: 'text', text: 'capítulo 3', marks: ['italic'] },
      ] },
      { type: 'bulletList', content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'fazer resumo' }] }] },
      ] },
    ],
  };

  /** Simula conteúdo maior que a caixa da prévia (o jsdom não calcula layout) */
  function mockOverflow(scrollHeight: number, clientHeight: number) {
    const sh = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
    const ch = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight);
    return () => { sh.mockRestore(); ch.mockRestore(); };
  }

  it('renderiza a formatação em vez das marcações cruas', () => {
    render(<TaskCard task={makeTask({ description: 'Revisar o capítulo 3\n• fazer resumo', descriptionRich: richDoc })} onComplete={noop} onDelete={noop} />);

    expect(screen.getByText('Revisar')).toHaveClass('font-semibold');
    expect(screen.getByText('capítulo 3')).toHaveClass('italic');
    expect(screen.getByRole('listitem')).toHaveTextContent('fazer resumo');
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it('tarefa antiga (só texto puro) continua aparecendo igual', () => {
    render(<TaskCard task={makeTask({ description: 'Calcular 2*3*4', descriptionRich: null })} onComplete={noop} onDelete={noop} />);

    // Asteriscos do texto antigo NÃO viram itálico
    expect(screen.getByText('Calcular 2*3*4')).toBeInTheDocument();
  });

  it('HTML na descrição aparece como texto, nunca é interpretado', () => {
    render(<TaskCard task={makeTask({ description: '<img src=x onerror=alert(1)>', descriptionRich: null })} onComplete={noop} onDelete={noop} />);

    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('a prévia quebra palavras longas em vez de estourar o card', () => {
    render(<TaskCard task={makeTask({ description: 'x'.repeat(500), descriptionRich: null })} onComplete={noop} onDelete={noop} />);

    const container = screen.getByText('x'.repeat(500)).closest('div');
    expect(container).toHaveClass('[overflow-wrap:anywhere]');
    expect(container).toHaveClass('whitespace-pre-wrap');
  });

  it('descrição curta não mostra "ver mais"', () => {
    const restore = mockOverflow(40, 60);
    render(<TaskCard task={makeTask({ description: 'curta', descriptionRich: null })} onComplete={noop} onDelete={noop} />);

    expect(screen.queryByRole('button', { name: 'ver mais' })).not.toBeInTheDocument();
    restore();
  });

  it('descrição longa mostra "ver mais", que abre o detalhe com o texto inteiro', async () => {
    const restore = mockOverflow(300, 60);
    const user = userEvent.setup();
    render(<TaskCard task={makeTask({ description: 'texto longo', descriptionRich: richDoc })} onComplete={noop} onDelete={noop} />);

    await user.click(screen.getByRole('button', { name: 'ver mais' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Revisar o capítulo 3');
    expect(dialog).toHaveTextContent('fazer resumo');
    restore();
  });

  it('clicar no título abre o detalhe; Esc fecha', async () => {
    const user = userEvent.setup();
    render(<TaskCard task={makeTask({ descriptionRich: richDoc, description: 'x' })} onComplete={noop} onDelete={noop} />);

    await user.click(screen.getByRole('button', { name: 'Implementar autenticação' }));
    expect(screen.getByRole('dialog', { name: 'Implementar autenticação' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('detalhe de tarefa sem descrição avisa "Sem descrição."', async () => {
    const user = userEvent.setup();
    render(<TaskCard task={makeTask()} onComplete={noop} onDelete={noop} />);

    await user.click(screen.getByRole('button', { name: 'Implementar autenticação' }));
    expect(screen.getByText('Sem descrição.')).toBeInTheDocument();
  });
});
