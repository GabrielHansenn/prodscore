import { forwardRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, type TextInputProps, type StyleProp, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING, FONT } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry' | 'style'> {
  /** Estilo extra da borda (ex: vermelha quando o campo tem erro) */
  style?: StyleProp<TextStyle>;
}

/**
 * Campo de senha com botão de mostrar/ocultar — o mesmo recurso que o login
 * e o cadastro do web já tinham.
 */
const PasswordInput = forwardRef<TextInput, PasswordInputProps>(function PasswordInput({ style, ...props }, ref) {
  const colors = useThemeColors();
  const styles = useStyles();
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        ref={ref}
        {...props}
        style={styles.input}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.textMuted}
      />
      <TouchableOpacity
        onPress={() => setVisible((v) => !v)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
});

export default PasswordInput;

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  wrapper: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.input,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  input: {
    flex:              1,
    paddingHorizontal: SPACING.md,
    paddingVertical:   12,
    fontSize:          FONT.base,
    color:             colors.text,
  },
  // 44×44: área de toque recomendada
  toggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
}));
