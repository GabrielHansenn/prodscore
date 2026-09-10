import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { PickedImage } from '../lib/useImageUpload';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

interface ImagePickerFieldProps {
  label:             string;
  image:             PickedImage | null;
  /** URL já persistida (capa atual), usada quando não há seleção nova */
  currentUrl:        string | null;
  fallbackIcon:      ComponentProps<typeof Ionicons>['name'];
  onTakePhoto:       () => void;
  onPickFromLibrary: () => void;
  onClear:           () => void;
}

/**
 * Campo de upload de imagem com preview — equivalente ao `ImagePickerField`
 * do web, adaptado pra câmera/galeria via `expo-image-picker`.
 */
export default function ImagePickerField({
  label, image, currentUrl, fallbackIcon, onTakePhoto, onPickFromLibrary, onClear,
}: ImagePickerFieldProps) {
  const imageSrc = image?.uri ?? currentUrl;

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <View style={styles.preview}>
          {imageSrc ? (
            <Image source={{ uri: imageSrc }} style={styles.previewImage} />
          ) : (
            <Ionicons name={fallbackIcon} size={26} color={COLORS.primary} />
          )}
        </View>

        <View style={styles.actions}>
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.smallBtn} onPress={onTakePhoto}>
              <Ionicons name="camera-outline" size={14} color={COLORS.primary} />
              <Text style={styles.smallBtnText}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallBtn} onPress={onPickFromLibrary}>
              <Ionicons name="image-outline" size={14} color={COLORS.primary} />
              <Text style={styles.smallBtnText}>Galeria</Text>
            </TouchableOpacity>
          </View>
          {image && (
            <TouchableOpacity onPress={onClear}>
              <Text style={styles.cancelText}>Cancelar seleção</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Text style={styles.helpText}>JPG, PNG, WebP ou GIF • máx. 2 MB</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: FONT.sm, fontWeight: '500', color: COLORS.textSecondary, marginBottom: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  preview: {
    width: 64, height: 64, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryDim,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: { width: '100%', height: '100%' },
  actions: { flex: 1, gap: SPACING.xs },
  btnRow: { flexDirection: 'row', gap: SPACING.xs },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
  },
  smallBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  cancelText: { fontSize: 12, color: COLORS.textMuted },
  helpText: { fontSize: 11, color: COLORS.textMuted, marginTop: SPACING.xs },
});
