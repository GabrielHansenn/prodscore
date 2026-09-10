import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MemberRole } from '@prodscore/shared';
import { COLORS, FONT, RADIUS, SPACING, CARD_SHADOW } from '../constants/theme';

export interface GroupCardData {
  id:          string;
  name:        string;
  description: string | null;
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

const ROLE_COLORS: Record<MemberRole, string> = {
  [MemberRole.Owner]:  COLORS.amber,
  [MemberRole.Admin]:  COLORS.primary400,
  [MemberRole.Member]: COLORS.textSecondary,
};

/** Card de preview de grupo com nome, membros e posição do usuário */
export default function GroupCard({ group, onPress }: GroupCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.iconCircle}>
        {group.imageUrl ? (
          <Image source={{ uri: group.imageUrl }} style={styles.iconImage} />
        ) : (
          <Ionicons name="people" size={20} color={COLORS.primary} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
        {group.description ? (
          <Text style={styles.desc} numberOfLines={1}>{group.description}</Text>
        ) : null}
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

const styles = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     COLORS.borderSoft,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    gap:             SPACING.md,
    ...CARD_SHADOW,
  },
  iconCircle: {
    width:           44,
    height:          44,
    borderRadius:    RADIUS.md,
    backgroundColor: COLORS.primaryDim,
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
    color:      COLORS.text,
  },
  desc: {
    fontSize: FONT.sm,
    color:    COLORS.textMuted,
  },
  meta: {
    flexDirection: 'row',
    gap:           SPACING.md,
  },
  members: {
    fontSize: FONT.sm,
    color:    COLORS.textMuted,
  },
  pos: {
    fontSize: FONT.sm,
    color:    COLORS.primary,
    fontWeight: '600',
  },
  roleBadge: {
    fontSize:   FONT.sm,
    fontWeight: '600',
  },
});
