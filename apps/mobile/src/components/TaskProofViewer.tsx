import { useEffect, useState } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTaskProofUrl } from '../services/proof.service';
import { COLORS, RADIUS } from '../constants/theme';

interface TaskProofViewerProps {
  /** UUID da tarefa cuja comprovação será exibida */
  taskId: string;
}

/**
 * Miniatura da foto de comprovação de uma tarefa concluída, carregada via
 * signed URL temporária. Toque abre em tamanho maior (lightbox).
 */
export default function TaskProofViewer({ taskId }: TaskProofViewerProps) {
  const [url,          setUrl]          = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);

    void getTaskProofUrl(taskId)
      .then((signedUrl) => { if (active) setUrl(signedUrl); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [taskId]);

  if (error) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setLightboxOpen(true)}
        disabled={loading || !url}
        style={styles.thumb}
        accessibilityLabel="Ver foto de comprovação em tamanho maior"
      >
        {loading || !url
          ? <ActivityIndicator size="small" color={COLORS.textMuted} />
          : <Image source={{ uri: url }} style={styles.thumbImage} />
        }
      </TouchableOpacity>

      <Modal visible={lightboxOpen} transparent animationType="fade">
        <Pressable style={styles.lightboxOverlay} onPress={() => setLightboxOpen(false)}>
          {url && <Image source={{ uri: url }} style={styles.lightboxImage} resizeMode="contain" />}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setLightboxOpen(false)}
            accessibilityLabel="Fechar imagem"
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: 40, height: 40, borderRadius: RADIUS.md, overflow: 'hidden',
    backgroundColor: COLORS.borderSoft, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  thumbImage: { width: '100%', height: '100%' },

  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '100%', height: '80%' },
  closeBtn: {
    position: 'absolute', top: 48, right: 20, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
});
