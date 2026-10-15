/**
 * Testes do modal padrão do web (X10 da auditoria de UX): antes, os modais de
 * tarefa, grupo e "nível atingido" não fechavam com Esc nem clicando fora e
 * não eram anunciados como diálogo.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../components/Modal';

function renderModal(onClose = vi.fn()) {
  render(
    <Modal onClose={onClose} labelledBy="titulo">
      <h2 id="titulo">Nova Tarefa</h2>
      <input aria-label="Título" />
    </Modal>,
  );
  return onClose;
}

describe('Modal', () => {
  it('é anunciado como diálogo com o título', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'Nova Tarefa' })).toHaveAttribute('aria-modal', 'true');
  });

  it('leva o foco para o primeiro campo', () => {
    renderModal();
    expect(screen.getByLabelText('Título')).toHaveFocus();
  });

  it('Esc fecha', async () => {
    const onClose = renderModal();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clique no fundo fecha; clique dentro do painel não', async () => {
    const onClose = renderModal();
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Título'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
