import type { ReactNode } from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import { CONTENT_MAX_WIDTH } from '../lib/useResponsive';

interface ResponsiveContainerProps {
  children: ReactNode;
  style?:   StyleProp<ViewStyle>;
}

/** Centraliza o conteúdo com largura máxima em telas largas (espelha mx-auto max-w-* do web) */
export default function ResponsiveContainer({ children, style }: ResponsiveContainerProps) {
  return (
    <View style={[{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }, style]}>
      {children}
    </View>
  );
}
