import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MemberRole, getDescriptionDoc, type RichTextDoc } from '@prodscore/shared';
import { FONT, RADIUS, SPACING, CARD_SHADOW, type ColorPalette } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';
import RichTextPreview from './RichTextPreview';

/** Altura máxima da prévia da descrição: ~2 linhas de fonte 12 */
const PREVIEW_MAX_HEIGHT = 36;

export interface GroupCardData {
  id:          string;
  name:        string;
  description: string | null;
  descriptionRich: RichTextDoc | null;
  imageUrl:    string | null;
  memberCount: number;
  role:        MemberRole;
  myPosition?: number;
}

interface GroupCardProps {
  group:   GroupCardData;
  onPress: () => void;
}

const ROLE_LABELS: Record<MemberRole, string> = {
  [MemberRole.Owner]:  'Dono',
  [MemberRole.Admin]:  'Admin',
  [MemberRole.Member]: 'Membro',
};

function getRoleColors(colors: ColorPalette): Record<MemberRole, string> {
  return {
    [MemberRole.Owner]:  colors.amber,
    [MemberRole.Admin]:  colors.primary400,
    [MemberRole.Member]: colors.textSecondary,
  };
}

/** Card de preview de grupo com nome, membros e posição do usuário */
export default function GroupCard({ group, onPress }: GroupCardProps) {
  const colors = useThemeColors();
  const styles = useStyles();
  const ROLE_COLORS = getRoleColors(colors);
  const description = getDescriptionDoc(group);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.iconCircle}>
        {group.imageUrl ? (
          <Image source={{ uri: group.imageUrl }} style={styles.iconImage} />
        ) : (
          <Ionicons name="people" size={20} color={colors.primary} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
        {/* "ver mais" abre o grupo, onde a descrição aparece inteira */}
        {description && (
          <RichTextPreview doc={description} maxHeight={PREVIEW_MAX_HEIGHT} onShowMore={onPress} />
        )}
        <View style={styles.meta}>
          <Text style={styles.members}>
            {group.memberCount} {group.memberCount === 1 ? 'membro' : 'membros'}
          </Text>
          {group.myPosition !== undefined && (
            <Text style={styles.pos}>#{group.myPosition} no ranking</Text>
          )}
        </View>
      </View>
      <Text style={[styles.roleBadge, { color: ROLE_COLORS[group.role] }]}>
        {ROLE_LABELS[group.role]}
      </Text>
    </TouchableOpacity>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     colors.borderSoft,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    gap:             SPACING.md,
    ...CARD_SHADOW,
  },
  iconCircle: {
    width:           44,
    height:          44,
    borderRadius:    RADIUS.md,
    backgroundColor: colors.primaryDim,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  iconImage: {
    width:  '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    gap:  3,
  },
  name: {
    fontSize:   FONT.base,
    fontWeight: '700',
    color:      colors.text,
  },
  meta: {
    flexDirection: 'row',
    gap:           SPACING.md,
  },
  members: {
    fontSize: FONT.sm,
    color:    colors.textMuted,
  },
  pos: {
    fontSize: FONT.sm,
    color:    colors.primary,
    fontWeight: '600',
  },
  roleBadge: {
    fontSize:   FONT.sm,
    fontWeight: '600',
  },
}));
