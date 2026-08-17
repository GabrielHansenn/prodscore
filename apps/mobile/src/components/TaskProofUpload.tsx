import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Image, ActivityIndicator, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCEPTED_PROOF_MIME_TYPES,
  MAX_PROOF_FILE_SIZE_BYTES,
  MAX_PROOF_FILE_SIZE_MB,
  type ProofMimeType,
  type TaskProof,
} from '@prodscore/shared';
import { uploadTaskProof } from '../services/proof.service';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';

interface TaskProofUploadProps {
  /** UUID da tarefa que está sendo concluída */
  taskId: string;
  /** Chamado quando a foto é enviada e registrada com sucesso */
  onUploaded: (proof: TaskProof) => void;
  /** Chamado ao cancelar o fluxo sem enviar */
  onCancel: () => void;
}

interface SelectedPhoto {
  uri:  string;
  name: string;
  type: ProofMimeType;
}

function extensionFor(mimeType: ProofMimeType): string {
  return mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
}

/** Deriva o mimeType real do asset, com fallback pela extensão do nome do arquivo */
function resolveMimeType(mimeType: string | undefined, fileName: string | null | undefined): ProofMimeType | null {
  if (mimeType && ACCEPTED_PROOF_MIME_TYPES.includes(mimeType as ProofMimeType)) {
    return mimeType as ProofMimeType;
  }
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (ext === 'png')          return 'image/png';
  if (ext === 'webp')         return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return null;
}

/**
 * Modal de anexo de comprovação fotográfica ao concluir uma tarefa.
 *
 * Fluxo: tirar foto ou escolher da galeria → validar formato e tamanho →
 * pré-visualizar → confirmar envio (com progresso).
 */
export default function TaskProofUpload({ taskId, onUploaded, onCancel }: TaskProofUploadProps) {
  const [photo,      setPhoto]      = useState<SelectedPhoto | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [error,      setError]      = useState('');

  const validateAndSet = (asset: ImagePicker.ImagePickerAsset) => {
    const resolvedType = resolveMimeType(asset.mimeType, asset.fileName);
    if (!resolvedType) {
      setError('Formato inválido. Envie uma imagem JPEG, PNG ou WebP.');
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_PROOF_FILE_SIZE_BYTES) {
      setError(`A imagem deve ter no máximo ${MAX_PROOF_FILE_SIZE_MB} MB.`);
      return;
    }
    setError('');
    setPhoto({
      uri:  asset.uri,
      name: asset.fileName ?? `comprovacao.${extensionFor(resolvedType)}`,
      type: resolvedType,
    });
  };

  const handlePermissionDenied = (context: 'câmera' | 'galeria') => {
    setError(
      `Permissão de acesso à ${context} negada. Habilite o acesso nas configurações do dispositivo para anexar uma foto.`,
    );
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      handlePermissionDenied('câmera');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) validateAndSet(result.assets[0]);
  };

  const handlePickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      handlePermissionDenied('galeria');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) validateAndSet(result.assets[0]);
  };

  const handleConfirm = async () => {
    if (!photo) return;
    setUploading(true);
    setError('');
    setProgress(0);
    try {
      const proof = await uploadTaskProof(taskId, photo, setProgress);
      onUploaded(proof);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar a foto de comprovação.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.sheet}>
          <Text style={styles.title}>Comprovação de conclusão</Text>
          <Text style={styles.subtitle}>Esta tarefa exige uma foto como comprovação para ser concluída.</Text>

          {!photo ? (
            <View style={styles.pickerRow}>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => void handleTakePhoto()}>
                <Ionicons name="camera-outline" size={22} color={COLORS.primary} />
                <Text style={styles.pickerBtnText}>Tirar foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => void handlePickFromLibrary()}>
                <Ionicons name="images-outline" size={22} color={COLORS.primary} />
                <Text style={styles.pickerBtnText}>Escolher da galeria</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Image source={{ uri: photo.uri }} style={styles.preview} />

              {uploading && (
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>Enviando... {progress}%</Text>
                </View>
              )}

              <TouchableOpacity onPress={() => setPhoto(null)} disabled={uploading}>
                <Text style={[styles.changeText, uploading && { opacity: 0.5 }]}>Trocar foto</Text>
              </TouchableOpacity>
            </View>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              {error.includes('configurações') && (
                <TouchableOpacity onPress={() => void Linking.openSettings()}>
                  <Text style={styles.errorLink}>Abrir configurações</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel} disabled={uploading}>
              <Text style={styles.secondaryBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, (!photo || uploading) && styles.btnDisabled]}
              onPress={() => void handleConfirm()}
              disabled={!photo || uploading}
            >
              {uploading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.primaryBtnText}>Confirmar e concluir</Text>
              }
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: SPACING.lg },
  sheet: { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: SPACING.lg, ...CARD_SHADOW },
  title: { fontSize: FONT.lg, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: FONT.sm, color: COLORS.textMuted, marginTop: 4, marginBottom: SPACING.md },

  pickerRow: { flexDirection: 'row', gap: SPACING.sm },
  pickerBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingVertical: SPACING.lg,
  },
  pickerBtnText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.primary, textAlign: 'center' },

  preview: { width: '100%', height: 220, borderRadius: RADIUS.lg, marginBottom: SPACING.sm },
  changeText: { fontSize: FONT.sm, fontWeight: '600', color: COLORS.primary, marginBottom: SPACING.sm },

  progressWrap: { marginBottom: SPACING.sm },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.borderSoft, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary },
  progressText: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },

  errorBox: { backgroundColor: COLORS.redDim, borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.sm },
  errorText: { fontSize: 12, color: COLORS.red },
  errorLink: { fontSize: 12, fontWeight: '700', color: COLORS.red, marginTop: 4, textDecorationLine: 'underline' },

  btnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: FONT.base, fontWeight: '600', color: COLORS.textSecondary },
  primaryBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT.base },
  btnDisabled: { opacity: 0.6 },
});
