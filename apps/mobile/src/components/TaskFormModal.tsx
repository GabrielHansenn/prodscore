import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, ScrollView, ActivityIndicator, Pressable,
  KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import {
  TaskDifficulty, TaskPriority, TaskStatus, validateRequired, getDescriptionDoc, richTextToPlainText,
  localDateKey, endOfLocalDayISO,
  MAX_TASK_DESCRIPTION_LENGTH, type Task, type RichTextDoc,
} from '@prodscore/shared';
import { getFriendlyErrorMessage } from '../lib/errors';
import { markdownToRichText, richTextToMarkdown } from '../lib/markdownToRichText';
import { showToast } from '../store/toastStore';
import Dropdown from './Dropdown';
import InlineFeedback, { FieldError } from './InlineFeedback';
import RichTextInput from './RichTextInput';
import { FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

export const BASE_POINTS: Record<TaskDifficulty, number> = {
  [TaskDifficulty.Easy]: 10, [TaskDifficulty.Medium]: 25, [TaskDifficulty.Hard]: 50, [TaskDifficulty.Epic]: 100,
};
const PRIORITY_MULT: Record<TaskPriority, number> = {
  [TaskPriority.Low]: 0.9, [TaskPriority.Medium]: 1, [TaskPriority.High]: 1.1, [TaskPriority.Urgent]: 1.25,
};

const DIFFICULTY_OPTIONS: Array<{ value: TaskDifficulty; label: string }> = [
  { value: TaskDifficulty.Easy,   label: 'Fácil'   },
  { value: TaskDifficulty.Medium, label: 'Médio'   },
  { value: TaskDifficulty.Hard,   label: 'Difícil' },
  { value: TaskDifficulty.Epic,   label: 'Épico'   },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: TaskPriority.Low,    label: 'Baixa'   },
  { value: TaskPriority.Medium, label: 'Média'   },
  { value: TaskPriority.High,   label: 'Alta'    },
  { value: TaskPriority.Urgent, label: 'Urgente' },
];

// ---------------------------------------------------------------------------
// Máscara de data brasileira (DD/MM/AAAA) para o campo Prazo
// ---------------------------------------------------------------------------

/** Aplica a máscara DD/MM/AAAA conforme o usuário digita (só dígitos, insere as barras) */
function maskDateBR(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

/** Converte DD/MM/AAAA (completo e válido) em AAAA-MM-DD para a API — null se incompleta/inválida */
function parseDateBR(masked: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(masked);
  if (!match) return null;
  const [, dd, mm, yyyy] = match as unknown as [string, string, string, string];
  const day = Number(dd), month = Number(mm), year = Number(yyyy);
  const date = new Date(year, month - 1, day);
  // new Date() "rola" datas inválidas (ex: 31/02 vira 03/03) — se não bater, não existe
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Erro do campo Prazo, ou null se vazio/válido. Só avalia a data completa
 * (DD/MM/AAAA) — assim o aviso aparece ao terminar de digitar, não só ao salvar.
 */
function dueDateError(masked: string): string | null {
  const value = masked.trim();
  if (value.length < 10) return null;
  const parsed = parseDateBR(value);
  const endOfDay = parsed ? endOfLocalDayISO(parsed) : null;
  if (!endOfDay) return 'Essa data não existe.';
  if (new Date(endOfDay) <= new Date()) return 'A data de entrega deve ser hoje ou depois.';
  return null;
}

/** Atalhos de prazo: hoje, amanhã e daqui a uma semana (dias no fuso do aparelho) */
const DUE_SHORTCUTS: Array<{ label: string; days: number | null }> = [
  { label: 'Hoje',        days: 0 },
  { label: 'Amanhã',      days: 1 },
  { label: 'Em 1 semana', days: 7 },
  { label: 'Sem prazo',   days: null },
];

/** AAAA-MM-DD (como vem da API) → DD/MM/AAAA (como o usuário vê) */
function isoToBR(iso: string): string {
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

// ---------------------------------------------------------------------------
// Modal de criar/editar tarefa — espelha TaskModal do web
// ---------------------------------------------------------------------------

export interface TaskFormData {
  title: string; difficulty: TaskDifficulty; priority: TaskPriority;
  estimatedMinutes?: number; dueDate?: string; requiresProof?: boolean;
  /** null limpa a descrição (edição) */
  descriptionRich?: RichTextDoc | null;
  groupId?: string;
}

/** Texto inicial do campo de descrição: o documento salvo convertido para a marcação do compositor */
function initialDescriptionText(task: Task | null): string {
  const doc = task ? getDescriptionDoc(task) : null;
  return doc ? richTextToMarkdown(doc) : '';
}

interface TaskFormModalProps {
  task:     Task | null;
  /**
   * Quando informado, a tarefa criada é vinculada a este grupo — único
   * ajuste necessário pra reaproveitar este formulário na criação de tarefa
   * de grupo (GroupDetailScreen), mantendo os mesmos campos/fluxo da criação
   * individual (TasksScreen).
   */
  groupId?: string;
  onClose:  () => void;
  onSubmit: (data: TaskFormData) => Promise<void>;
}

/** Formulário de criação/edição de tarefa — único componente usado tanto na criação individual quanto na de grupo. */
export default function TaskFormModal({ task, groupId, onClose, onSubmit }: TaskFormModalProps) {
  const colors = useThemeColors();
  const styles = useStyles();
  const [title,          setTitle]          = useState(task?.title ?? '');
  const [description,    setDescription]    = useState(() => initialDescriptionText(task));
  const [difficulty,     setDifficulty]     = useState<TaskDifficulty>(task?.difficulty ?? TaskDifficulty.Medium);
  const [priority,       setPriority]       = useState<TaskPriority>(task?.priority ?? TaskPriority.Medium);
  const [estMinutes,     setEstMinutes]     = useState(task?.estimatedMinutes?.toString() ?? '');
  // Dia do prazo no fuso do aparelho (o ISO da API está em UTC)
  const [dueDateInput,   setDueDateInput]   = useState(task?.dueDate ? isoToBR(localDateKey(new Date(task.dueDate))) : '');
  const [requiresProof,  setRequiresProof]  = useState(task?.requiresProof ?? false);
  const [error,          setError]          = useState('');
  const [loading,        setLoading]        = useState(false);

  const isEdit      = task !== null;
  const liveDueError = dueDateError(dueDateInput);
  const isCompleted = task?.status === TaskStatus.Completed;
  const pts         = Math.floor(BASE_POINTS[difficulty] * PRIORITY_MULT[priority]);

  const handleSubmit = async () => {
    const titleError = validateRequired(title, 'Título');
    if (titleError) { setError(titleError); return; }

    const descriptionDoc = markdownToRichText(description);
    if (descriptionDoc && richTextToPlainText(descriptionDoc).length > MAX_TASK_DESCRIPTION_LENGTH) {
      setError(`A descrição deve ter no máximo ${MAX_TASK_DESCRIPTION_LENGTH} caracteres.`);
      return;
    }

    // 23h59 do dia escolhido no fuso do aparelho (antes era 23h59 UTC = 20h59 no Brasil)
    let due: string | undefined;
    if (dueDateInput.trim()) {
      const parsed = parseDateBR(dueDateInput.trim());
      const endOfDay = parsed ? endOfLocalDayISO(parsed) : null;
      if (!endOfDay) { setError('Data de prazo inválida. Use o formato DD/MM/AAAA.'); return; }
      if (new Date(endOfDay) <= new Date()) { setError('A data de entrega deve ser no futuro.'); return; }
      due = endOfDay;
    }

    setError('');
    setLoading(true);
    try {
      const est = estMinutes ? parseInt(estMinutes, 10) : undefined;
      await onSubmit({
        title: title.trim(), difficulty, priority, requiresProof,
        ...(est ? { estimatedMinutes: est } : {}),
        // Na edição sempre envia (null = apagou a descrição); na criação só se preenchida
        ...(isEdit || descriptionDoc ? { descriptionRich: descriptionDoc } : {}),
        ...(due ? { dueDate: due } : {}),
        ...(groupId ? { groupId } : {}),
      });
      onClose();
      showToast(isEdit ? 'Tarefa atualizada com sucesso!' : 'Tarefa criada com sucesso!');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Erro ao salvar tarefa.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.modalOverlay} onPress={onClose}>
          <Pressable style={styles.formSheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}</Text>

              {isCompleted && (
                <View style={styles.warnBox}>
                  <Text style={styles.warnText}>Tarefas concluídas não podem ser editadas.</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Título</Text>
              <TextInput
                style={styles.input} value={title} onChangeText={setTitle} editable={!isCompleted}
                placeholder="Ex: Estudar para a prova de cálculo" placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>Descrição (opcional)</Text>
              <RichTextInput
                value={description} onChangeText={setDescription} editable={!isCompleted}
                placeholder="Descreva o que precisa ser feito..."
              />

              <View style={styles.rowFields}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Dificuldade</Text>
                  <Dropdown value={difficulty} options={DIFFICULTY_OPTIONS} onChange={setDifficulty} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Prioridade</Text>
                  <Dropdown value={priority} options={PRIORITY_OPTIONS} onChange={setPriority} />
                </View>
              </View>

              <View style={styles.rowFields}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Prazo</Text>
                  <TextInput
                    style={[styles.input, liveDueError ? styles.inputError : null]} value={dueDateInput}
                    onChangeText={(t) => setDueDateInput(maskDateBR(t))}
                    editable={!isCompleted} keyboardType="number-pad" maxLength={10}
                    placeholder="DD/MM/AAAA" placeholderTextColor={colors.textMuted}
                    accessibilityLabel="Prazo, no formato dia, mês e ano"
                  />
                  <FieldError msg={liveDueError ?? undefined} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Tempo estimado (min)</Text>
                  <TextInput
                    style={styles.input} value={estMinutes} onChangeText={setEstMinutes} editable={!isCompleted}
                    keyboardType="number-pad" placeholder="Ex: 60" placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Atalhos de prazo: um toque em vez de digitar a data */}
              {!isCompleted && (
                <View style={styles.dueShortcuts}>
                  {DUE_SHORTCUTS.map((s) => {
                    const value = s.days === null ? '' : (() => {
                      const d = new Date();
                      d.setDate(d.getDate() + s.days);
                      return isoToBR(localDateKey(d));
                    })();
                    const active = dueDateInput === value;
                    return (
                      <TouchableOpacity
                        key={s.label}
                        style={[styles.dueChip, active && styles.dueChipActive]}
                        onPress={() => setDueDateInput(value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.dueChipText, active && styles.dueChipTextActive]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.proofRow}>
                <Text style={[styles.fieldLabel, styles.proofLabel]}>Exige comprovação fotográfica para concluir</Text>
                <Switch
                  value={requiresProof}
                  onValueChange={setRequiresProof}
                  disabled={isCompleted}
                  trackColor={{ false: colors.border, true: colors.primary400 }}
                  thumbColor={requiresProof ? colors.primary : '#fff'}
                />
              </View>

              <View style={styles.ptsPreview}>
                <Text style={styles.ptsText}>
                  Esta tarefa vale <Text style={{ fontWeight: '700' }}>{pts} pontos</Text>
                </Text>
              </View>

              {error ? <InlineFeedback variant="error" message={error} /> : null}

              <View style={styles.formBtnRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                  <Text style={styles.secondaryBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { flex: 1 }, (loading || isCompleted) && { opacity: 0.6 }]}
                  onPress={() => void handleSubmit()}
                  disabled={loading || isCompleted}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.btnText}>{isEdit ? 'Salvar alterações' : 'Criar Tarefa'}</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.lg },
  formSheet: { backgroundColor: colors.card, borderRadius: RADIUS.xl, padding: SPACING.lg, maxHeight: '85%', ...CARD_SHADOW },
  modalTitle: { fontSize: FONT.lg, fontWeight: '700', color: colors.text, marginBottom: SPACING.md },
  warnBox: { backgroundColor: colors.amberDim, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md },
  warnText: { fontSize: 12, color: colors.amberText },
  fieldLabel: { fontSize: FONT.sm, fontWeight: '500', color: colors.textSecondary, marginBottom: 4 },
  input: { backgroundColor: colors.input, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.inputBorder, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: FONT.base, color: colors.text },
  inputError: { borderColor: colors.red },
  dueShortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  dueChip: { borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.md, paddingVertical: 8 },
  dueChipActive: { backgroundColor: colors.primaryDim, borderColor: colors.primary },
  dueChipText: { fontSize: FONT.sm, color: colors.textSecondary },
  dueChipTextActive: { color: colors.primary, fontWeight: '600' },
  rowFields: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },

  proofRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md, gap: SPACING.sm },
  // flex:1 trava a largura do rótulo — sem isso o texto longo empurra o Switch pra fora da tela
  proofLabel: { flex: 1, marginBottom: 0 },
  ptsPreview: { backgroundColor: colors.primaryDim, borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.md },
  ptsText: { fontSize: 12, color: colors.primary },
  formBtnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: FONT.base, fontWeight: '600', color: colors.textSecondary },
  btn: { backgroundColor: colors.primary, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: FONT.base },
}));
