import { MAX_PROOF_FILE_SIZE_BYTES, type TaskProof, type ProofMimeType } from '@prodscore/shared';
import { supabase } from '../lib/supabase.js';
import { AppError } from '../lib/errors.js';
import { detectImageType, extensionForImageType } from '../lib/imageSniff.js';

const BUCKET = 'task-proofs';
/** Validade da signed URL de exibição — curta de propósito (nunca URL permanente) */
const SIGNED_URL_TTL_SECONDS = 5 * 60;

interface TaskOwnershipRow {
  id: string;
  user_id: string;
  group_id: string | null;
  status: string;
}

interface TaskProofRow {
  id: string;
  task_id: string;
  user_id: string;
  storage_path: string;
  content_type: string;
  file_size: number;
  created_at: string;
}

function mapProofRow(row: TaskProofRow): TaskProof {
  return {
    id:          row.id,
    taskId:      row.task_id,
    userId:      row.user_id,
    contentType: row.content_type as ProofMimeType,
    fileSize:    row.file_size,
    createdAt:   row.created_at,
  };
}

/** Busca a tarefa e confirma que pertence ao usuário e ainda não foi concluída */
async function getOwnedEditableTask(taskId: string, userId: string): Promise<TaskOwnershipRow> {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, user_id, group_id, status')
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new AppError('Erro ao buscar tarefa.', 500);
  if (!data) throw new AppError('Tarefa não encontrada.', 404, 'TAREFA_NAO_ENCONTRADA');

  const task = data as TaskOwnershipRow;
  if (task.status === 'completed') {
    throw new AppError('Tarefas concluídas não podem ter a comprovação alterada.', 409, 'TAREFA_JA_CONCLUIDA');
  }

  return task;
}

/**
 * Verifica se o usuário pode visualizar a prova de uma tarefa: o dono dela,
 * ou um membro do grupo ao qual a tarefa pertence (verificação de ranking).
 * Espelha a policy "task_proofs_select_group_member" da migration — a API
 * usa service_role (contorna RLS), então a regra precisa ser reforçada aqui.
 */
async function assertCanViewProof(taskId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, user_id, group_id')
    .eq('id', taskId)
    .maybeSingle();

  if (error) throw new AppError('Erro ao buscar tarefa.', 500);
  if (!data) throw new AppError('Tarefa não encontrada.', 404, 'TAREFA_NAO_ENCONTRADA');

  const task = data as Pick<TaskOwnershipRow, 'id' | 'user_id' | 'group_id'>;
  if (task.user_id === userId) return;

  if (task.group_id) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', task.group_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (membership) return;
  }

  throw new AppError('Você não tem permissão para ver esta comprovação.', 403, 'ACESSO_NEGADO');
}

// ---------------------------------------------------------------------------
// Upload / substituição
// ---------------------------------------------------------------------------

/**
 * Anexa (ou substitui) a comprovação fotográfica de uma tarefa.
 *
 * Validação server-side obrigatória: o tipo é detectado pelos bytes reais
 * do arquivo (nunca pelo Content-Type do cliente) e o tamanho é conferido
 * de novo aqui, além do limite já imposto pelo multer na rota.
 *
 * @param taskId - UUID da tarefa
 * @param userId - UUID do usuário autenticado (deve ser o dono)
 * @param buffer - Bytes do arquivo enviado
 */
export async function uploadTaskProof(
  taskId: string,
  userId: string,
  buffer: Buffer,
): Promise<TaskProof> {
  await getOwnedEditableTask(taskId, userId);

  if (buffer.length === 0) {
    throw new AppError('Arquivo vazio.', 400, 'ARQUIVO_INVALIDO');
  }
  if (buffer.length > MAX_PROOF_FILE_SIZE_BYTES) {
    throw new AppError('A imagem deve ter no máximo 5 MB.', 400, 'ARQUIVO_MUITO_GRANDE');
  }

  const contentType = detectImageType(buffer);
  if (!contentType) {
    throw new AppError(
      'Formato de imagem inválido. Envie um arquivo JPEG, PNG ou WebP.',
      400,
      'FORMATO_INVALIDO',
    );
  }

  // Substitui uma prova existente, se houver (remove o arquivo antigo do Storage)
  const { data: existing } = await supabase
    .from('task_proofs')
    .select('storage_path')
    .eq('task_id', taskId)
    .maybeSingle();

  const storagePath = `${userId}/${taskId}.${extensionForImageType(contentType)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (uploadError) {
    throw new AppError('Erro ao enviar a imagem. Tente novamente.', 500, 'UPLOAD_FALHOU');
  }

  // Se o path mudou (ex: formato diferente do anterior), remove o arquivo antigo
  const existingPath = (existing as { storage_path: string } | null)?.storage_path;
  if (existingPath && existingPath !== storagePath) {
    await supabase.storage.from(BUCKET).remove([existingPath]);
  }

  const { data: proofRow, error: upsertError } = await supabase
    .from('task_proofs')
    .upsert(
      {
        task_id:      taskId,
        user_id:      userId,
        storage_path: storagePath,
        content_type: contentType,
        file_size:    buffer.length,
      },
      { onConflict: 'task_id' },
    )
    .select('*')
    .single();

  if (upsertError || !proofRow) {
    // Rollback best-effort do arquivo já enviado, para não deixar órfão
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new AppError('Erro ao registrar a comprovação.', 500, 'REGISTRO_FALHOU');
  }

  return mapProofRow(proofRow as TaskProofRow);
}

// ---------------------------------------------------------------------------
// Exibição — signed URL
// ---------------------------------------------------------------------------

/**
 * Gera uma signed URL temporária para exibir a comprovação de uma tarefa.
 * Nunca retorna o storage_path nem uma URL permanente.
 *
 * @param taskId - UUID da tarefa
 * @param userId - UUID do usuário autenticado (dono ou membro do grupo)
 */
export async function getTaskProofSignedUrl(taskId: string, userId: string): Promise<string> {
  await assertCanViewProof(taskId, userId);

  const { data: proof, error } = await supabase
    .from('task_proofs')
    .select('storage_path')
    .eq('task_id', taskId)
    .maybeSingle();

  if (error) throw new AppError('Erro ao buscar comprovação.', 500);
  if (!proof) throw new AppError('Esta tarefa não tem comprovação anexada.', 404, 'PROVA_NAO_ENCONTRADA');

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl((proof as { storage_path: string }).storage_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) {
    throw new AppError('Erro ao gerar link de acesso à imagem.', 500, 'SIGNED_URL_FALHOU');
  }

  return signed.signedUrl;
}

// ---------------------------------------------------------------------------
// Remoção
// ---------------------------------------------------------------------------

/**
 * Remove a comprovação de uma tarefa — apaga o arquivo do Storage e o
 * registro no banco (LGPD: eliminação real, não só a referência).
 *
 * @param taskId - UUID da tarefa
 * @param userId - UUID do usuário autenticado (deve ser o dono)
 */
export async function deleteTaskProof(taskId: string, userId: string): Promise<void> {
  await getOwnedEditableTask(taskId, userId);

  const { data: proof } = await supabase
    .from('task_proofs')
    .select('storage_path')
    .eq('task_id', taskId)
    .maybeSingle();

  if (!proof) return;

  await supabase.storage.from(BUCKET).remove([(proof as { storage_path: string }).storage_path]);

  const { error } = await supabase.from('task_proofs').delete().eq('task_id', taskId);
  if (error) {
    throw new AppError('Erro ao remover a comprovação.', 500, 'REMOCAO_FALHOU');
  }
}

/**
 * Remove do Storage o arquivo de comprovação de uma tarefa específica, sem
 * checar ownership — uso interno ao excluir a própria tarefa (o registro em
 * task_proofs já cai sozinho via ON DELETE CASCADE, mas o arquivo no Storage
 * precisa ser apagado explicitamente).
 */
export async function purgeProofFileForTask(taskId: string): Promise<void> {
  const { data: proof } = await supabase
    .from('task_proofs')
    .select('storage_path')
    .eq('task_id', taskId)
    .maybeSingle();

  if (!proof) return;

  await supabase.storage.from(BUCKET).remove([(proof as { storage_path: string }).storage_path]);
}

/**
 * Remove do Storage todos os arquivos de comprovação de um usuário — uso
 * interno ao excluir a conta (LGPD: direito à eliminação). Os registros em
 * task_proofs caem sozinhos via ON DELETE CASCADE quando auth.users é
 * apagado, mas os arquivos no Storage precisam ser removidos antes.
 */
export async function purgeAllProofFilesForUser(userId: string): Promise<void> {
  const { data: proofs, error } = await supabase
    .from('task_proofs')
    .select('storage_path')
    .eq('user_id', userId);

  if (error || !proofs || proofs.length === 0) return;

  const paths = (proofs as Array<{ storage_path: string }>).map((p) => p.storage_path);
  await supabase.storage.from(BUCKET).remove(paths);
}
