import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { MemberRole } from '@prodscore/shared';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

export interface GroupCardData {
  id:          string;
  name:        string;
  description: string | null;
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
  [MemberRole.Admin]:  COLORS.violet,
  [MemberRole.Member]: COLORS.textSecondary,
};

/** Card de preview de grupo com nome, membros e posição do usuário */
export default function GroupCard({ group, onPress }: GroupCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconEmoji}>👥</Text>
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
    borderColor:     COLORS.border,
    padding:         SPACING.md,
    marginBottom:    SPACING.sm,
    gap:             SPACING.md,
  },
  iconCircle: {
    width:           44,
    height:          44,
    borderRadius:    RADIUS.md,
    backgroundColor: COLORS.emeraldDim,
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconEmoji: {
    fontSize: 20,
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
    color:    COLORS.emerald,
    fontWeight: '600',
  },
  roleBadge: {
    fontSize:   FONT.sm,
    fontWeight: '600',
  },
});
