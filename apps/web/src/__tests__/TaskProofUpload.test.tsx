/**
 * Testes do componente TaskProofUpload.
 * Serviço de upload e compressão de imagem são mockados para isolar o fluxo
 * de validação/seleção/confirmação da foto de comprovação.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockUploadTaskProof, mockCompressImage } = vi.hoisted(() => ({
  mockUploadTaskProof: vi.fn(),
  mockCompressImage:   vi.fn(),
}));

vi.mock('../services/proof.service.js', () => ({
  uploadTaskProof: mockUploadTaskProof,
}));

vi.mock('../lib/imageCompression.js', () => ({
  compressImage: mockCompressImage,
}));

import TaskProofUpload from '../components/TaskProofUpload';

function makeFile(overrides: Partial<{ name: string; type: string; size: number }> = {}): File {
  const { name = 'foto.jpg', type = 'image/jpeg', size = 1024 } = overrides;
  const file = new File([new Uint8Array(size)], name, { type });
  return file;
}

describe('TaskProofUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-preview');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('deve rejeitar arquivos com formato inválido e não chamar compressImage', async () => {
    render(<TaskProofUpload taskId="task-1" onUploaded={vi.fn()} onCancel={vi.fn()} />);

    // fireEvent.change (em vez de userEvent.upload) contorna a validação de
    // `accept` do próprio user-event, permitindo simular um arquivo fora do
    // formato aceito para exercitar a validação feita pelo componente.
    const input = screen.getByLabelText('Selecionar ou tirar foto de comprovação');
    fireEvent.change(input, { target: { files: [makeFile({ name: 'documento.pdf', type: 'application/pdf' })] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Formato inválido. Envie uma imagem JPEG, PNG ou WebP.');
    });
    expect(mockCompressImage).not.toHaveBeenCalled();
  });

  it('deve rejeitar arquivos maiores que 5 MB e não chamar compressImage', async () => {
    render(<TaskProofUpload taskId="task-1" onUploaded={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByLabelText('Selecionar ou tirar foto de comprovação');
    await userEvent.upload(input, makeFile({ size: 6 * 1024 * 1024 }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('A imagem deve ter no máximo 5 MB.');
    });
    expect(mockCompressImage).not.toHaveBeenCalled();
  });

  it('deve comprimir e mostrar a prévia após selecionar um arquivo válido', async () => {
    mockCompressImage.mockResolvedValue(new Blob(['fake'], { type: 'image/jpeg' }));

    render(<TaskProofUpload taskId="task-1" onUploaded={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByLabelText('Selecionar ou tirar foto de comprovação');
    await userEvent.upload(input, makeFile());

    await waitFor(() => {
      expect(screen.getByAltText('Prévia da foto de comprovação')).toBeInTheDocument();
    });
    expect(mockCompressImage).toHaveBeenCalledTimes(1);
  });

  it('deve enviar a foto comprimida ao confirmar e chamar onUploaded com a comprovação retornada', async () => {
    mockCompressImage.mockResolvedValue(new Blob(['fake'], { type: 'image/jpeg' }));
    const proof = { id: 'proof-1', taskId: 'task-1', userId: 'user-1', contentType: 'image/jpeg', fileSize: 4, createdAt: '2026-01-01T00:00:00.000Z' };
    mockUploadTaskProof.mockResolvedValue(proof);
    const onUploaded = vi.fn();

    render(<TaskProofUpload taskId="task-1" onUploaded={onUploaded} onCancel={vi.fn()} />);

    const input = screen.getByLabelText('Selecionar ou tirar foto de comprovação');
    await userEvent.upload(input, makeFile());

    await waitFor(() => screen.getByAltText('Prévia da foto de comprovação'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar e concluir' }));

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith(proof);
    });
    expect(mockUploadTaskProof).toHaveBeenCalledWith('task-1', expect.any(Blob), 'comprovacao.jpg', expect.any(Function));
  });

  it('deve exibir mensagem de erro em português quando o envio falha', async () => {
    mockCompressImage.mockResolvedValue(new Blob(['fake'], { type: 'image/jpeg' }));
    mockUploadTaskProof.mockRejectedValue(new Error('Erro ao enviar a foto de comprovação.'));

    render(<TaskProofUpload taskId="task-1" onUploaded={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByLabelText('Selecionar ou tirar foto de comprovação');
    await userEvent.upload(input, makeFile());

    await waitFor(() => screen.getByAltText('Prévia da foto de comprovação'));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar e concluir' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Erro ao enviar a foto de comprovação.');
    });
  });

  it('deve chamar onCancel ao clicar em Cancelar', async () => {
    const onCancel = vi.fn();
    render(<TaskProofUpload taskId="task-1" onUploaded={vi.fn()} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
