import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

export interface RankingRow {
  position:      number;
  userId:        string;
  username:      string;
  avatarUrl:     string | null;
  level:         number;
  score:         number;
  currentStreak: number;
}

interface RankingItemProps {
  row:           RankingRow;
  isCurrentUser: boolean;
}

const MEDALS = ['🥇', '🥈', '🥉'];

/** Linha única no placar de líderes */
export default function RankingItem({ row, isCurrentUser }: RankingItemProps) {
  const medal = row.position <= 3 ? MEDALS[row.position - 1] : undefined;

  return (
    <View style={[styles.row, isCurrentUser && styles.rowHighlight]}>
      {/* Posição */}
      <View style={styles.posCell}>
        <Text style={[styles.pos, row.position === 1 && { color: COLORS.amber }]}>
          {medal ?? `#${row.position}`}
        </Text>
      </View>

      {/* Avatar + nome */}
      <View style={styles.avatar}>
        <Text style={styles.avatarLetter}>
          {row.username.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.nameCell}>
        <Text style={[styles.username, isCurrentUser && { color: COLORS.primary }]} numberOfLines={1}>
          {row.username}{isCurrentUser ? ' (você)' : ''}
        </Text>
        <Text style={styles.level}>Nível {row.level}</Text>
      </View>

      {/* Streak + score */}
      <View style={styles.right}>
        {row.currentStreak > 0 && (
          <Text style={styles.streak}>🔥 {row.currentStreak}</Text>
        )}
        <Text style={[styles.score, isCurrentUser && { color: COLORS.primary }]}>
          {row.score.toLocaleString('pt-BR')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderColor:    COLORS.border,
  },
  rowHighlight: {
    backgroundColor: 'rgba(124,58,237,0.06)',
  },
  posCell: {
    width: 36,
  },
  pos: {
    fontSize:   FONT.base,
    fontWeight: '700',
    color:      COLORS.textMuted,
  },
  avatar: {
    width:          34,
    height:         34,
    borderRadius:   17,
    backgroundColor: COLORS.border,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    SPACING.sm,
  },
  avatarLetter: {
    fontSize:   FONT.base,
    fontWeight: '700',
    color:      COLORS.textSecondary,
  },
  nameCell: {
    flex: 1,
    gap:  2,
  },
  username: {
    fontSize:   FONT.base,
    fontWeight: '600',
    color:      COLORS.text,
  },
  level: {
    fontSize: FONT.sm,
    color:    COLORS.primary400,
  },
  right: {
    alignItems: 'flex-end',
    gap:        2,
  },
  streak: {
    fontSize: FONT.sm,
    color:    COLORS.amber,
  },
  score: {
    fontSize:   FONT.base,
    fontWeight: '700',
    color:      COLORS.text,
  },
});
