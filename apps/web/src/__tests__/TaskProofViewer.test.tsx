/**
 * Testes do componente TaskProofViewer.
 * Serviço de signed URL é mockado para isolar o fluxo de exibição/lightbox.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockGetTaskProofUrl } = vi.hoisted(() => ({
  mockGetTaskProofUrl: vi.fn(),
}));

vi.mock('../services/proof.service.js', () => ({
  getTaskProofUrl: mockGetTaskProofUrl,
}));

import TaskProofViewer from '../components/TaskProofViewer';

describe('TaskProofViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve exibir a miniatura e abrir o lightbox ao clicar no botão', async () => {
    mockGetTaskProofUrl.mockResolvedValue('https://signed.example/proof.jpg');
    const user = userEvent.setup();

    render(<TaskProofViewer taskId="task-1" />);

    const button = await screen.findByRole('button', { name: 'Ver foto de comprovação em tamanho maior' });
    await waitFor(() => expect(button).not.toBeDisabled());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(button);

    const dialog = await screen.findByRole('dialog', { name: 'Foto de comprovação em tamanho maior' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByAltText('Comprovação de conclusão da tarefa, em tamanho maior')).toHaveAttribute(
      'src',
      'https://signed.example/proof.jpg',
    );
  });

  it('deve fechar o lightbox com Esc e devolver o foco ao botão de origem', async () => {
    mockGetTaskProofUrl.mockResolvedValue('https://signed.example/proof.jpg');
    const user = userEvent.setup();

    render(<TaskProofViewer taskId="task-1" />);

    const button = await screen.findByRole('button', { name: 'Ver foto de comprovação em tamanho maior' });
    await waitFor(() => expect(button).not.toBeDisabled());
    await user.click(button);

    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(button).toHaveFocus();
  });

  it('não deve renderizar nada quando a busca da signed URL falha', async () => {
    mockGetTaskProofUrl.mockRejectedValue(new Error('Erro ao carregar a foto de comprovação.'));

    const { container } = render(<TaskProofViewer taskId="task-1" />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
