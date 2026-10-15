import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FORMAT_BUTTONS, toggleWrap, toggleListPrefix } from '../lib/markdownToRichText';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

interface RichTextInputProps {
  /** Texto em marcação leve (**negrito**, - lista...) — converta com markdownToRichText ao salvar */
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
}

/**
 * Campo de texto com barra de formatação — mesma marcação do compositor do
 * chat. A barra envolve a seleção com os delimitadores; quem usa o campo
 * converte o texto para o documento de texto rico ao salvar.
 */
export default function RichTextInput({ value, onChangeText, placeholder, editable = true }: RichTextInputProps) {
  const colors = useThemeColors();
  const styles = useStyles();
  const [selection, setSelection] = useState({ start: value.length, end: value.length });

  const apply = (result: { text: string; selection: { start: number; end: number } }) => {
    onChangeText(result.text);
    setSelection(result.selection);
  };

  return (
    <View style={[styles.container, !editable && { opacity: 0.6 }]}>
      <View style={styles.toolbar}>
        {FORMAT_BUTTONS.map((b) => (
          <TouchableOpacity
            key={b.label}
            style={styles.toolBtn}
            disabled={!editable}
            onPress={() => apply(toggleWrap(value, selection, b.wrapper))}
            accessibilityLabel={b.label}
          >
            <Text style={[styles.toolBtnText, b.label === 'Negrito' && { fontWeight: '700' }, b.label === 'Itálico' && { fontStyle: 'italic' }]}>
              {b.icon}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={styles.toolDivider} />
        <TouchableOpacity
          style={styles.toolBtn}
          disabled={!editable}
          onPress={() => apply(toggleListPrefix(value, selection, 'bullet'))}
          accessibilityLabel="Lista com marcadores"
        >
          <Ionicons name="list" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolBtn}
          disabled={!editable}
          onPress={() => apply(toggleListPrefix(value, selection, 'ordered'))}
          accessibilityLabel="Lista numerada"
        >
          <Ionicons name="reorder-four-outline" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        selection={selection}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: {
    backgroundColor: colors.input,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     colors.inputBorder,
    overflow:        'hidden',
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2,
    paddingHorizontal: SPACING.xs, paddingVertical: 2,
    borderBottomWidth: 1, borderColor: colors.borderSoft,
  },
  toolBtn: { width: 30, height: 30, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  toolBtnText: { fontSize: 12, color: colors.textSecondary },
  toolDivider: { width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: 4 },
  input: {
    minHeight: 96, maxHeight: 200,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    fontSize: FONT.base, color: colors.text,
  },
}));
