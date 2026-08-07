import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownProps<T extends string> {
  value:    T;
  options:  DropdownOption<T>[];
  onChange: (value: T) => void;
  style?:   object;
}

/** Seletor estilo <select> do web — botão que abre uma lista de opções em modal */
export default function Dropdown<T extends string>({ value, options, onChange, style }: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <TouchableOpacity style={[styles.trigger, style]} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={styles.triggerText} numberOfLines={1}>{current?.label ?? value}</Text>
        <Ionicons name="chevron-down" size={14} color={COLORS.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item.value === value && styles.optionActive]}
                  onPress={() => { onChange(item.value); setOpen(false); }}
                >
                  <Text style={[styles.optionText, item.value === value && styles.optionTextActive]}>
                    {item.label}
                  </Text>
                  {item.value === value && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:             SPACING.xs,
    backgroundColor: COLORS.card,
    borderWidth:     1,
    borderColor:     COLORS.inputBorder,
    borderRadius:    RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   9,
  },
  triggerText: { fontSize: 12, color: COLORS.textSecondary, flexShrink: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: SPACING.xl },
  sheet: {
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    maxHeight:       360,
    overflow:        'hidden',
  },
  option: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical:   13,
    borderBottomWidth: 1,
    borderColor:       COLORS.borderSoft,
  },
  optionActive:    { backgroundColor: COLORS.primaryDim },
  optionText:      { fontSize: FONT.sm, color: COLORS.text },
  optionTextActive: { color: COLORS.primary, fontWeight: '600' },
});
