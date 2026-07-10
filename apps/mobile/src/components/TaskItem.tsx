import { useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, PanResponder,
} from 'react-native';
import { TaskDifficulty, TaskStatus, type Task } from '@prodscore/shared';
import { COLORS, FONT, RADIUS, SPACING } from '../constants/theme';

interface TaskItemProps {
  task:       Task;
  onComplete: (id: string) => void;
  onDelete:   (id: string) => void;
}

const DIFF_COLORS: Record<TaskDifficulty, string> = {
  [TaskDifficulty.Easy]:   COLORS.emerald,
  [TaskDifficulty.Medium]: COLORS.blue,
  [TaskDifficulty.Hard]:   '#fb923c',
  [TaskDifficulty.Epic]:   COLORS.violet,
};

const DIFF_LABELS: Record<TaskDifficulty, string> = {
  [TaskDifficulty.Easy]:   'Fácil',
  [TaskDifficulty.Medium]: 'Médio',
  [TaskDifficulty.Hard]:   'Difícil',
  [TaskDifficulty.Epic]:   'Épico',
};

const BASE_POINTS: Record<TaskDifficulty, number> = {
  [TaskDifficulty.Easy]:   10,
  [TaskDifficulty.Medium]: 25,
  [TaskDifficulty.Hard]:   50,
  [TaskDifficulty.Epic]:   100,
};

const SWIPE_THRESHOLD = 80;

/**
 * Item de tarefa com gesto de swipe:
 * - Swipe direita (>80px) → concluir
 * - Swipe esquerda (<-80px) → excluir
 */
export default function TaskItem({ task, onComplete, onDelete }: TaskItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isCompleted = task.status === TaskStatus.Completed;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 5 && !isCompleted,
      onPanResponderMove: (_, g) => { translateX.setValue(g.dx); },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) {
          // Swipe direita: concluir
          Animated.timing(translateX, { toValue: 400, duration: 250, useNativeDriver: true }).start(() => {
            onComplete(task.id);
            translateX.setValue(0);
          });
        } else if (g.dx < -SWIPE_THRESHOLD) {
          // Swipe esquerda: excluir
          Animated.timing(translateX, { toValue: -400, duration: 250, useNativeDriver: true }).start(() => {
            onDelete(task.id);
            translateX.setValue(0);
          });
        } else {
          // Volta para posição original
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const diffColor = DIFF_COLORS[task.difficulty];
  const pts       = isCompleted && task.pointsEarned !== null
    ? task.pointsEarned
    : BASE_POINTS[task.difficulty];

  return (
    <View style={styles.wrapper}>
      {/* Fundo do swipe direita (verde = completar) */}
      <View style={[styles.swipeBg, styles.swipeBgRight]}>
        <Text style={styles.swipeLabel}>✓ Concluir</Text>
      </View>
      {/* Fundo do swipe esquerda (vermelho = excluir) */}
      <View style={[styles.swipeBg, styles.swipeBgLeft]}>
        <Text style={styles.swipeLabel}>🗑 Excluir</Text>
      </View>

      <Animated.View
        style={[styles.card, isCompleted && styles.cardCompleted, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.diffBar, { backgroundColor: diffColor }]} />
        <View style={styles.content}>
          <View style={styles.row}>
            <Text
              style={[styles.title, isCompleted && styles.titleDone]}
              numberOfLines={1}
            >
              {task.title}
            </Text>
            <Text style={[styles.points, { color: diffColor }]}>+{pts}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.badge, { color: diffColor }]}>
              {DIFF_LABELS[task.difficulty]}
            </Text>
            {task.dueDate && (
              <Text style={styles.due}>
                📅 {new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </Text>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  swipeBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
  },
  swipeBgRight: {
    backgroundColor: COLORS.emeraldDim,
    alignItems:      'flex-start',
    paddingLeft:     SPACING.md,
  },
  swipeBgLeft: {
    backgroundColor: COLORS.redDim,
    alignItems:      'flex-end',
    paddingRight:    SPACING.md,
  },
  swipeLabel: {
    color:      COLORS.text,
    fontWeight: '600',
    fontSize:   FONT.sm,
  },
  card: {
    flexDirection:   'row',
    backgroundColor: COLORS.card,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
    overflow:        'hidden',
  },
  cardCompleted: {
    opacity: 0.55,
  },
  diffBar: {
    width: 4,
  },
  content: {
    flex:    1,
    padding: SPACING.md,
    gap:     SPACING.xs,
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  title: {
    flex:       1,
    fontSize:   FONT.base,
    fontWeight: '600',
    color:      COLORS.text,
    marginRight: SPACING.sm,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color:              COLORS.textMuted,
  },
  points: {
    fontSize:   FONT.sm,
    fontWeight: '700',
  },
  badge: {
    fontSize:   FONT.sm,
    fontWeight: '500',
  },
  due: {
    fontSize: FONT.sm,
    color:    COLORS.textMuted,
  },
});
