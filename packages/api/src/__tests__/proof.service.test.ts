/**
 * Testes do serviço de comprovação fotográfica de tarefas.
 * Cliente Supabase é mockado para isolar a lógica de rede/Storage.
 */

jest.mock('../lib/supabase');

import {
  uploadTaskProof,
  getTaskProofSignedUrl,
  deleteTaskProof,
} from '../services/proof.service';
import { supabase } from '../lib/supabase';

const mockFrom          = supabase.from as jest.Mock;
const mockStorageFrom    = supabase.storage.from as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures — buffers com magic bytes reais/inválidos
// ---------------------------------------------------------------------------

const validJpegBuffer   = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const invalidTypeBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]);

const taskId = 'task-1';
const ownerId = 'user-1';
const otherUserId = 'user-2';

function pendingTaskRow(overrides: Partial<{ user_id: string; status: string }> = {}) {
  return { id: taskId, user_id: ownerId, group_id: null, status: 'pending', ...overrides };
}

/** Monta o mock de storage.from() com os métodos usados pelo serviço */
function mockStorageMethods(overrides: {
  upload?: jest.Mock;
  remove?: jest.Mock;
  createSignedUrl?: jest.Mock;
} = {}) {
  mockStorageFrom.mockReturnValue({
    upload:          overrides.upload          ?? jest.fn().mockResolvedValue({ error: null }),
    remove:          overrides.remove          ?? jest.fn().mockResolvedValue({ error: null }),
    createSignedUrl: overrides.createSignedUrl ?? jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/proof.jpg' },
      error: null,
    }),
  });
}

describe('uploadTaskProof', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageMethods();
  });

  it('deve rejeitar formato de arquivo inválido com mensagem em português', async () => {
    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: pendingTaskRow(), error: null }),
          }),
        }),
      }),
    });

    await expect(uploadTaskProof(taskId, ownerId, invalidTypeBuffer)).rejects.toThrow(
      'Formato de imagem inválido. Envie um arquivo JPEG, PNG ou WebP.',
    );
  });

  it('deve rejeitar arquivo maior que o limite permitido', async () => {
    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: pendingTaskRow(), error: null }),
          }),
        }),
      }),
    });

    const oversizedBuffer = Buffer.concat([validJpegBuffer, Buffer.alloc(6 * 1024 * 1024)]);

    await expect(uploadTaskProof(taskId, ownerId, oversizedBuffer)).rejects.toThrow(
      'A imagem deve ter no máximo 5 MB.',
    );
  });

  it('deve bloquear anexar prova em tarefa de outro usuário', async () => {
    // A query já filtra por user_id — tarefa de outro dono não é encontrada
    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    await expect(uploadTaskProof(taskId, otherUserId, validJpegBuffer)).rejects.toThrow(
      'Tarefa não encontrada.',
    );
  });

  it('deve bloquear anexar prova em tarefa já concluída', async () => {
    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: pendingTaskRow({ status: 'completed' }), error: null }),
          }),
        }),
      }),
    });

    await expect(uploadTaskProof(taskId, ownerId, validJpegBuffer)).rejects.toThrow(
      'Tarefas concluídas não podem ter a comprovação alterada.',
    );
  });

  it('deve aceitar e registrar uma imagem JPEG válida', async () => {
    const upsertSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'proof-1', task_id: taskId, user_id: ownerId,
        storage_path: `${ownerId}/${taskId}.jpg`, content_type: 'image/jpeg',
        file_size: validJpegBuffer.length, created_at: '2025-01-01T00:00:00.000Z',
      },
      error: null,
    });

    mockFrom
      // Passo 1: busca a tarefa (ownership + status)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: pendingTaskRow(), error: null }),
            }),
          }),
        }),
      })
      // Passo 2: busca prova existente (nenhuma ainda)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })
      // Passo 3: upsert do registro da prova
      .mockReturnValueOnce({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({ single: upsertSingle }),
        }),
      });

    const result = await uploadTaskProof(taskId, ownerId, validJpegBuffer);

    expect(result.contentType).toBe('image/jpeg');
    expect(result.taskId).toBe(taskId);
  });
});

describe('getTaskProofSignedUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageMethods();
  });

  it('deve bloquear acesso de quem não é dono nem membro do grupo', async () => {
    mockFrom
      // assertCanViewProof: busca a tarefa (sem filtro de user_id)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: pendingTaskRow(), error: null }),
          }),
        }),
      });

    await expect(getTaskProofSignedUrl(taskId, otherUserId)).rejects.toThrow(
      'Você não tem permissão para ver esta comprovação.',
    );
  });

  it('deve gerar signed URL para o dono da tarefa', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: pendingTaskRow(), error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { storage_path: `${ownerId}/${taskId}.jpg` },
              error: null,
            }),
          }),
        }),
      });

    const url = await getTaskProofSignedUrl(taskId, ownerId);
    expect(url).toBe('https://signed.example/proof.jpg');
  });
});

describe('deleteTaskProof', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageMethods();
  });

  it('deve remover o arquivo do Storage e o registro no banco', async () => {
    const removeMock = jest.fn().mockResolvedValue({ error: null });
    mockStorageMethods({ remove: removeMock });

    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: pendingTaskRow(), error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { storage_path: `${ownerId}/${taskId}.jpg` },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

    await deleteTaskProof(taskId, ownerId);

    expect(removeMock).toHaveBeenCalledWith([`${ownerId}/${taskId}.jpg`]);
  });
});
