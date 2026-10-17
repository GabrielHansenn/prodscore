/**
 * Testes do formulário de edição do perfil: Salvar desabilitado até algo
 * mudar, validação do nome de usuário enquanto digita, contador da bio e
 * confirmação antes de descartar alterações não salvas.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';

const { mockPatch, mockShowToast } = vi.hoisted(() => ({
  mockPatch:     vi.fn(),
  mockShowToast: vi.fn(),
}));

vi.mock('../services/api.js', () => ({ api: { patch: mockPatch } }));
vi.mock('../store/toastStore.js', () => ({ showToast: mockShowToast }));
vi.mock('../lib/supabase.js', () => ({ supabase: { storage: { from: vi.fn() } } }));

import ProfileEditForm from '../components/profile/ProfileEditForm';

const user = {
  id:        'user-1',
  username:  'gabriel',
  email:     'gabriel@example.com',
  bio:       'Estudante',
  avatarUrl: null,
};

function renderForm() {
  const onCancel = vi.fn();
  const onSaved  = vi.fn();
  render(<ProfileEditForm user={user} onCancel={onCancel} onSaved={onSaved} />);
  return {
    onCancel,
    onSaved,
    username: screen.getByLabelText('Nome de usuário'),
    bio:      screen.getByLabelText(/^Bio/),
    save:     screen.getByRole('button', { name: 'Salvar alterações' }),
    cancel:   screen.getByRole('button', { name: 'Cancelar' }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProfileEditForm — botão salvar', () => {
  it('começa desabilitado enquanto nada mudou', () => {
    const { save } = renderForm();
    expect(save).toBeDisabled();
  });

  it('habilita ao alterar um campo e volta a desabilitar ao desfazer a alteração', async () => {
    const { bio, save } = renderForm();

    await userEvent.type(bio, ' de TI');
    expect(save).toBeEnabled();

    await userEvent.clear(bio);
    await userEvent.type(bio, 'Estudante');
    expect(save).toBeDisabled();
  });

  it('espaços nas pontas não contam como alteração', async () => {
    const { username, save } = renderForm();
    await userEvent.type(username, '   ');
    expect(save).toBeDisabled();
  });

  it('salva os valores aparados, mostra o toast e sai da edição', async () => {
    mockPatch.mockResolvedValue({ data: {} });
    const { bio, save, onSaved } = renderForm();

    await userEvent.clear(bio);
    await userEvent.type(bio, '  Dev  ');
    await userEvent.click(save);

    expect(mockPatch).toHaveBeenCalledWith('/users/me', { username: 'gabriel', bio: 'Dev' });
    expect(mockShowToast).toHaveBeenCalledWith('Perfil atualizado com sucesso!');
    expect(onSaved).toHaveBeenCalled();
  });

  it('não envia duas vezes com clique duplo (botão bloqueado durante o envio)', async () => {
    let resolvePatch: (v: unknown) => void = () => undefined;
    mockPatch.mockReturnValue(new Promise((r) => { resolvePatch = r; }));
    const { bio, save } = renderForm();

    await userEvent.type(bio, '!');
    await userEvent.click(save);
    expect(screen.getByRole('button', { name: /Salvando/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Salvando/ }));

    expect(mockPatch).toHaveBeenCalledTimes(1);
    resolvePatch({ data: {} });
  });
});

describe('ProfileEditForm — validação do nome de usuário', () => {
  it('mostra as regras como texto de ajuda ligado ao campo', () => {
    const { username } = renderForm();
    const help = screen.getByText(/De 3 a 30 caracteres/);
    expect(username.getAttribute('aria-describedby')).toContain(help.id);
  });

  it('valida enquanto digita: curto demais', async () => {
    const { username, save } = renderForm();

    await userEvent.clear(username);
    await userEvent.type(username, 'ab');

    expect(screen.getByText('Use 3–30 caracteres: letras, números ou _.')).toBeInTheDocument();
    expect(username).toHaveAttribute('aria-invalid', 'true');
    expect(save).toBeDisabled();
  });

  it('valida enquanto digita: caracteres não permitidos', async () => {
    const { username, save } = renderForm();

    await userEvent.clear(username);
    await userEvent.type(username, 'joão silva');

    expect(username).toHaveAttribute('aria-invalid', 'true');
    expect(save).toBeDisabled();
  });

  it('a mensagem de erro fica ligada ao campo e é anunciada (aria-live)', async () => {
    const { username } = renderForm();

    await userEvent.clear(username);
    await userEvent.type(username, 'a');

    const error = screen.getByText('Use 3–30 caracteres: letras, números ou _.');
    expect(error).toHaveAttribute('aria-live', 'polite');
    expect(username.getAttribute('aria-describedby')).toContain(error.id);
  });

  it('nome válido limpa o erro e libera o salvar', async () => {
    const { username, save } = renderForm();

    await userEvent.clear(username);
    await userEvent.type(username, 'ab');
    await userEvent.type(username, 'c_1');

    expect(username).not.toHaveAttribute('aria-invalid');
    expect(save).toBeEnabled();
  });

  it('nome já em uso (409) aparece no próprio campo', async () => {
    mockPatch.mockRejectedValue(new AxiosError('conflict', '409', undefined, undefined, {
      status: 409, statusText: 'Conflict', data: {}, headers: {}, config: { headers: new AxiosHeaders() },
    }));
    const { username, save } = renderForm();

    await userEvent.clear(username);
    await userEvent.type(username, 'ocupado');
    await userEvent.click(save);

    expect(await screen.findByText('Este nome de usuário já está em uso. Escolha outro.')).toBeInTheDocument();
    expect(username).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('ProfileEditForm — bio', () => {
  it('mostra o contador com o limite do backend (300)', async () => {
    const { bio } = renderForm();
    expect(screen.getByText('9/300 caracteres')).toBeInTheDocument();

    await userEvent.type(bio, '!');
    expect(screen.getByText('10/300 caracteres')).toBeInTheDocument();
    expect(bio).toHaveAttribute('maxLength', '300');
  });
});

describe('ProfileEditForm — e-mail', () => {
  it('é somente leitura, com a dica', () => {
    renderForm();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('readonly');
    expect(screen.getByText('O e-mail não pode ser alterado por aqui.')).toBeInTheDocument();
  });
});

describe('ProfileEditForm — cancelar', () => {
  it('sem alterações, sai direto da edição', async () => {
    const { cancel, onCancel } = renderForm();

    await userEvent.click(cancel);

    expect(onCancel).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('com alterações, pede confirmação antes de descartar', async () => {
    const { bio, cancel, onCancel } = renderForm();

    await userEvent.type(bio, ' de TI');
    await userEvent.click(cancel);

    const dialog = screen.getByRole('dialog', { name: 'Descartar alterações?' });
    expect(onCancel).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Descartar' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('"Continuar editando" fecha a confirmação e mantém o que foi digitado', async () => {
    const { bio, cancel, onCancel } = renderForm();

    await userEvent.type(bio, ' de TI');
    await userEvent.click(cancel);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    expect(bio).toHaveValue('Estudante de TI');
  });
});
