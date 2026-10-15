import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { RichTextDoc } from '@prodscore/shared';
import RichText from './RichText';
import { FONT } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';

interface RichTextPreviewProps {
  doc: RichTextDoc;
  /** Altura máxima da prévia em pontos (ex: 52 ≈ 3 linhas de fonte 12) */
  maxHeight: number;
  /** "ver mais": abre o detalhe/tela, ou expande ali mesmo (ver `expandable`) */
  onShowMore?: () => void;
  /**
   * Se true, "ver mais" expande o texto no próprio lugar (e vira "ver menos")
   * em vez de chamar onShowMore — usado onde não há outra tela para abrir.
   */
  expandable?: boolean;
  fontSize?: number;
  color?: string;
}

/**
 * Prévia da descrição formatada (tarefas e grupos) — espelho do
 * RichTextPreview do web.
 *
 * Como a descrição pode ter vários parágrafos e listas, `numberOfLines` não
 * serve (só funciona num único <Text>). A prévia limita a ALTURA e mede o
 * conteúdo: a View interna não é limitada pelo maxHeight do pai, então o
 * onLayout dela informa a altura real — se passar do limite, mostra "ver mais".
 */
export default function RichTextPreview({
  doc, maxHeight, onShowMore, expandable = false, fontSize = 12, color,
}: RichTextPreviewProps) {
  const colors = useThemeColors();
  const styles = useStyles();
  const [contentHeight, setContentHeight] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const overflowing = contentHeight > maxHeight;
  const showFull = expandable && expanded;

  const handlePress = () => {
    if (expandable) setExpanded((v) => !v);
    else onShowMore?.();
  };

  return (
    <View>
      <View style={showFull ? null : { maxHeight, overflow: 'hidden' }}>
        <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
          <RichText doc={doc} fontSize={fontSize} color={color ?? colors.textMuted} />
        </View>
      </View>
      {overflowing && (expandable || onShowMore) && (
        <Text style={styles.showMore} onPress={handlePress} suppressHighlighting>
          {showFull ? 'ver menos' : 'ver mais'}
        </Text>
      )}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  showMore: { fontSize: FONT.sm, fontWeight: '600', color: colors.primary, marginTop: 2, alignSelf: 'flex-start' },
}));
