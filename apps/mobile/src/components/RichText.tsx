import { View, Text, StyleSheet, type TextStyle } from 'react-native';
import type { RichTextDoc, RichTextMark, RichTextText } from '@prodscore/shared';
import { FONT, SPACING } from '../constants/theme';
import { createThemedStyles } from '../lib/createThemedStyles';

/**
 * Renderiza um documento de texto rico em React Native.
 *
 * Espelho de apps/web/src/components/RichText.tsx. Como o conteúdo é JSON
 * estruturado (e não HTML), o mobile monta <Text> aninhado direto — sem
 * parser de HTML nem WebView.
 */

function styleForMarks(marks: RichTextMark[] | undefined, mono: TextStyle): TextStyle {
  const style: TextStyle = {};
  if (!marks) return style;

  if (marks.includes('bold'))   style.fontWeight = '700';
  if (marks.includes('italic')) style.fontStyle  = 'italic';

  // RN não combina underline + line-through em propriedades separadas
  const underline = marks.includes('underline');
  const strike    = marks.includes('strike');
  if (underline && strike) style.textDecorationLine = 'underline line-through';
  else if (underline)      style.textDecorationLine = 'underline';
  else if (strike)         style.textDecorationLine = 'line-through';

  if (marks.includes('code')) Object.assign(style, mono);

  return style;
}

function TextRuns({ nodes, color }: { nodes: RichTextText[]; color?: string }) {
  const styles = useStyles();
  return (
    <>
      {nodes.map((node, i) => (
        <Text key={i} style={[color ? { color } : null, styleForMarks(node.marks, styles.code)]}>
          {node.text}
        </Text>
      ))}
    </>
  );
}

interface RichTextProps {
  doc: RichTextDoc;
  color?: string;
  /** Tamanho da fonte — o padrão é FONT.base (chat, detalhe da tarefa) */
  fontSize?: number;
}

export default function RichText({ doc, color, fontSize }: RichTextProps) {
  const styles = useStyles();
  const sizeStyle: TextStyle | null = fontSize ? { fontSize, lineHeight: Math.round(fontSize * 1.45) } : null;
  const colorStyle: TextStyle | null = color ? { color } : null;

  return (
    <View style={styles.container}>
      {doc.content.map((block, i) => {
        if (block.type === 'paragraph') {
          return (
            <Text key={i} style={[styles.paragraph, sizeStyle, colorStyle]}>
              <TextRuns nodes={block.content ?? []} color={color} />
            </Text>
          );
        }

        return (
          <View key={i} style={styles.list}>
            {block.content.map((item, j) => (
              <View key={j} style={styles.listItem}>
                <Text style={[styles.bullet, sizeStyle, colorStyle]}>
                  {block.type === 'bulletList' ? '•' : `${j + 1}.`}
                </Text>
                {/* flex:1 limita a largura do item — sem isso texto longo sai da tela */}
                <Text style={[styles.paragraph, styles.listItemText, sizeStyle, colorStyle]}>
                  {item.content.map((p, k) => (
                    <TextRuns key={k} nodes={p.content ?? []} color={color} />
                  ))}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: { gap: 2 },
  paragraph: { fontSize: FONT.base, color: colors.text, lineHeight: 20 },
  list:      { gap: 2 },
  listItem:  { flexDirection: 'row', gap: 6 },
  bullet:    { fontSize: FONT.base, color: colors.text, lineHeight: 20, minWidth: 14 },
  listItemText: { flex: 1 },
  code: {
    fontFamily: 'monospace',
    backgroundColor: colors.borderSoft,
    paddingHorizontal: SPACING.xs,
  },
}));
