import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  TaskDifficulty, TaskPriority,
  buildHelpSections, describeAchievementCriteria, formatNumber, HELP_SECTION_IDS,
  CALCULATOR_DIFFICULTIES, CALCULATOR_PRIORITIES, DIFFICULTY_NAMES, PRIORITY_NAMES,
  taskPointsBreakdown, explainTaskPoints, describeLateTier,
  type HelpBlock, type HelpSectionId, type LevelReward, type TaskDelivery,
} from '@prodscore/shared';
import {
  getAchievements, getUserAchievements, getLevelRewards, type AchievementItem,
} from '../services/achievement.service';
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_ICON_FALLBACK } from '../constants/achievementIcons';
import { FONT, RADIUS, SPACING } from '../constants/theme';
import { useThemeColors } from '../lib/useThemeColors';
import { createThemedStyles } from '../lib/createThemedStyles';
import type { AppStackParamList } from '../navigation/index';

type Props = NativeStackScreenProps<AppStackParamList, 'Help'>;
type Loadable<T> = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: T };

/** Carrega uma vez ao abrir a tela; o erro aparece só no bloco afetado */
function useLoad<T>(load: () => Promise<T>): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => { if (!cancelled) setState({ status: 'ok', data }); })
      .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

// ---------------------------------------------------------------------------
// Calculadora
// ---------------------------------------------------------------------------

function Chips<T extends string>({
  label, options, value, onChange, names,
}: { label: string; options: ReadonlyArray<T>; value: T; onChange: (v: T) => void; names: Record<T, string> }) {
  const styles = useStyles();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(opt)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{names[opt]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

type When = 'no_prazo' | 'atrasada';
const WHEN_OPTIONS: ReadonlyArray<When> = ['no_prazo', 'atrasada'];
const WHEN_NAMES: Record<When, string> = { no_prazo: 'No prazo', atrasada: 'Com atraso' };

/** Usa taskPointsBreakdown, a MESMA função que o sistema usa ao concluir uma tarefa */
function Calculator() {
  const colors = useThemeColors();
  const styles = useStyles();
  const [difficulty, setDifficulty] = useState<TaskDifficulty>(TaskDifficulty.Medium);
  const [priority,   setPriority]   = useState<TaskPriority>(TaskPriority.Medium);
  const [when,       setWhen]       = useState<When>('no_prazo');
  const [hoursText,  setHoursText]  = useState('1');

  const hours = Math.max(0, Number(hoursText.replace(',', '.')) || 0);
  const delivery: TaskDelivery = when === 'no_prazo' ? { kind: 'on_time' } : { kind: 'late', hoursLate: hours };
  const breakdown = taskPointsBreakdown(difficulty, priority, delivery);

  return (
    <View style={styles.calc}>
      <Chips label="Dificuldade" options={CALCULATOR_DIFFICULTIES} value={difficulty} onChange={setDifficulty} names={DIFFICULTY_NAMES} />
      <Chips label="Prioridade"  options={CALCULATOR_PRIORITIES}   value={priority}   onChange={setPriority}   names={PRIORITY_NAMES} />
      <Chips label="Entrega"     options={WHEN_OPTIONS}            value={when}       onChange={setWhen}       names={WHEN_NAMES} />

      {when === 'atrasada' && (
        <View>
          <Text style={styles.fieldLabel}>Quantas horas de atraso?</Text>
          <TextInput
            style={styles.input}
            value={hoursText}
            onChangeText={setHoursText}
            keyboardType="decimal-pad"
            accessibilityLabel="Quantas horas de atraso?"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.small}>{describeLateTier(hours)}</Text>
        </View>
      )}

      <View style={styles.result} accessibilityLiveRegion="polite">
        <Text style={styles.small}>Você ganharia</Text>
        <Text style={styles.resultValue}>{formatNumber(breakdown.total)} {breakdown.total === 1 ? 'ponto' : 'pontos'}</Text>
        <Text style={styles.small}>{explainTaskPoints(breakdown, priority)}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Blocos vindos do banco
// ---------------------------------------------------------------------------

function LoadState({ state }: { state: Loadable<unknown> }) {
  const colors = useThemeColors();
  const styles = useStyles();
  if (state.status === 'loading') return <ActivityIndicator color={colors.primary} />;
  return <Text style={styles.errorText}>Não foi possível carregar agora. Tente de novo mais tarde.</Text>;
}

function LevelRewards({ state }: { state: Loadable<LevelReward[]> }) {
  const styles = useStyles();
  if (state.status !== 'ok') return <LoadState state={state} />;
  return (
    <View style={styles.gap}>
      {state.data.map((r) => (
        <View key={r.level} style={styles.box}>
          <Text style={styles.boxTitle}>Nível {formatNumber(r.level)}</Text>
          <Text style={styles.p}>
            {[
              r.bonusPoints > 0 ? `+${formatNumber(r.bonusPoints)} pontos` : null,
              r.bonusFreezes > 0 ? `+${formatNumber(r.bonusFreezes)} ${r.bonusFreezes === 1 ? 'freeze' : 'freezes'}` : null,
            ].filter(Boolean).join(' e ')}
          </Text>
          {!!r.description && <Text style={styles.small}>{r.description}</Text>}
        </View>
      ))}
    </View>
  );
}

function Achievements({ state }: { state: Loadable<{ all: AchievementItem[]; earned: Set<string> }> }) {
  const colors = useThemeColors();
  const styles = useStyles();
  if (state.status !== 'ok') return <LoadState state={state} />;
  const { all, earned } = state.data;
  return (
    <View style={styles.gap}>
      <Text style={styles.p}>Você já tem {formatNumber(all.filter((a) => earned.has(a.id)).length)} de {formatNumber(all.length)}.</Text>
      {all.map((a) => {
        const has = earned.has(a.id);
        return (
          <View key={a.id} style={[styles.box, styles.row, has && styles.boxEarned]}>
            <Ionicons name={ACHIEVEMENT_ICONS[a.icon] ?? ACHIEVEMENT_ICON_FALLBACK} size={22} color={has ? colors.amber : colors.textMuted} />
            <View style={styles.flex}>
              <Text style={styles.boxTitle}>{a.name}</Text>
              <Text style={[styles.tag, has ? styles.tagEarned : null]}>{has ? '✓ Você já tem' : 'Bloqueada'}</Text>
              <Text style={styles.p}>{describeAchievementCriteria(a.criteria) ?? a.description}</Text>
              {a.rewardPoints > 0 && <Text style={styles.reward}>+{formatNumber(a.rewardPoints)} pontos</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Blocos de texto (buildHelpSections, no shared)
// ---------------------------------------------------------------------------

function Block({ block, levelRewards, achievements }: {
  block: HelpBlock;
  levelRewards: Loadable<LevelReward[]>;
  achievements: Loadable<{ all: AchievementItem[]; earned: Set<string> }>;
}) {
  const styles = useStyles();
  switch (block.type) {
    case 'p':       return <Text style={styles.p}>{block.text}</Text>;
    case 'heading': return <Text style={styles.heading} accessibilityRole="header">{block.text}</Text>;
    case 'note':    return <View style={styles.note}><Text style={styles.noteText}>{block.text}</Text></View>;
    case 'list':
      return (
        <View style={styles.gapSm}>
          {block.items.map((item) => (
            <View key={item} style={styles.listRow}>
              <Text style={styles.p}>•</Text>
              <Text style={[styles.p, styles.flex]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case 'table':
      return (
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHead]}>
            <Text style={[styles.tableHeadText, styles.tableKey]}>{block.head[0]}</Text>
            <Text style={[styles.tableHeadText, styles.flex]}>{block.head[1]}</Text>
          </View>
          {block.rows.map(([a, b]) => (
            <View key={a} style={styles.tableRow}>
              <Text style={[styles.tableCellKey, styles.tableKey]}>{a}</Text>
              <Text style={[styles.tableCell, styles.flex]}>{b}</Text>
            </View>
          ))}
        </View>
      );
    case 'faq':
      return (
        <View style={styles.gap}>
          {block.items.map(({ q, a }) => (
            <View key={q}>
              <Text style={styles.boxTitle}>{q}</Text>
              <Text style={styles.p}>{a}</Text>
            </View>
          ))}
        </View>
      );
    case 'calculator':   return <Calculator />;
    case 'levelRewards': return <LevelRewards state={levelRewards} />;
    case 'achievements': return <Achievements state={achievements} />;
  }
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

/**
 * Ajuda: como funcionam os pontos e toda a gamificação, em linguagem simples.
 * Espelha /ajuda no web — os textos vêm de buildHelpSections (shared).
 * Os atalhos "?" abrem a tela com `section`: a seção abre e a tela rola até ela.
 */
export default function HelpScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useStyles();
  const sections = useMemo(() => buildHelpSections(), []);
  const target = route.params?.section ?? null;

  const [open, setOpen] = useState<Set<HelpSectionId>>(() => new Set([target ?? HELP_SECTION_IDS[0]!]));
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef(new Map<HelpSectionId, number>());
  // Seção para onde rolar assim que a posição dela for conhecida
  const pendingScroll = useRef<HelpSectionId | null>(target);

  const levelRewards = useLoad(getLevelRewards);
  const achievements = useLoad(async () => {
    const [all, mine] = await Promise.all([getAchievements(), getUserAchievements()]);
    return { all, earned: new Set(mine.map((a) => a.id)) };
  });

  // Novo atalho com a tela já aberta: abre a seção e rola até ela
  useEffect(() => {
    if (!target) return;
    setOpen((prev) => (prev.has(target) ? prev : new Set(prev).add(target)));
    const y = positions.current.get(target);
    if (y !== undefined) scrollRef.current?.scrollTo({ y, animated: true });
    else pendingScroll.current = target;
  }, [target]);

  const toggle = (id: HelpSectionId) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <Text style={styles.headerTitle}>Ajuda</Text>
          <Text style={styles.headerSub}>Como funcionam os pontos e tudo o que acontece no ProdScore</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}>
        {sections.map((s) => {
          const isOpen = open.has(s.id);
          return (
            <View
              key={s.id}
              style={styles.section}
              onLayout={(e) => {
                const y = e.nativeEvent.layout.y;
                positions.current.set(s.id, y);
                if (pendingScroll.current === s.id) {
                  pendingScroll.current = null;
                  scrollRef.current?.scrollTo({ y, animated: false });
                }
              }}
            >
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggle(s.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={`${s.title}. ${s.summary}`}
              >
                <View style={styles.flex}>
                  <Text style={styles.sectionTitle}>{s.title}</Text>
                  <Text style={styles.small}>{s.summary}</Text>
                </View>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
              </TouchableOpacity>
              {isOpen && (
                <View style={styles.sectionBody}>
                  {s.blocks.map((b, i) => <Block key={i} block={b} levelRewards={levelRewards} achievements={achievements} />)}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.background },
  header:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, paddingBottom: SPACING.sm },
  headerTitle: { fontSize: FONT.xl, fontWeight: '800', color: colors.text },
  headerSub:   { fontSize: FONT.sm, color: colors.textMuted, marginTop: 2 },
  list:        { padding: SPACING.md, gap: SPACING.sm },
  flex:        { flex: 1 },
  gap:         { gap: SPACING.sm },
  gapSm:       { gap: SPACING.xs },
  row:         { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },

  section:       { backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderSoft, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minHeight: 56, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  sectionTitle:  { fontSize: FONT.md, fontWeight: '700', color: colors.text },
  sectionBody:   { gap: SPACING.sm + 4, padding: SPACING.md, borderTopWidth: 1, borderColor: colors.borderSoft },

  p:        { fontSize: FONT.base, lineHeight: 21, color: colors.textSecondary },
  small:    { fontSize: FONT.sm, color: colors.textMuted, lineHeight: 17 },
  heading:  { fontSize: FONT.base, fontWeight: '700', color: colors.text, marginTop: SPACING.xs },
  note:     { backgroundColor: colors.amberDim, borderRadius: RADIUS.md, padding: SPACING.sm + 4 },
  noteText: { fontSize: FONT.base, lineHeight: 21, color: colors.amberText },
  listRow:  { flexDirection: 'row', gap: SPACING.sm },
  errorText: { fontSize: FONT.sm, color: colors.red },

  table:         { borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderSoft, overflow: 'hidden' },
  tableRow:      { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.sm + 4, paddingVertical: SPACING.sm, borderTopWidth: 1, borderColor: colors.borderSoft },
  tableHead:     { backgroundColor: colors.background, borderTopWidth: 0 },
  tableHeadText: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  tableKey:      { width: 110 },
  tableCellKey:  { fontSize: FONT.base, fontWeight: '600', color: colors.text },
  tableCell:     { fontSize: FONT.base, color: colors.textSecondary, lineHeight: 20 },

  box:       { borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderSoft, padding: SPACING.sm + 4 },
  boxEarned: { borderColor: colors.amber, backgroundColor: colors.amberDim },
  boxTitle:  { fontSize: FONT.base, fontWeight: '700', color: colors.text },
  tag:       { alignSelf: 'flex-start', fontSize: 11, fontWeight: '600', color: colors.textMuted, marginVertical: 2 },
  tagEarned: { color: colors.amberText },
  reward:    { fontSize: FONT.sm, fontWeight: '600', color: colors.amberText, marginTop: 2 },

  calc:           { gap: SPACING.md, backgroundColor: colors.background, borderRadius: RADIUS.lg, padding: SPACING.md },
  fieldLabel:     { fontSize: FONT.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: SPACING.xs },
  chips:          { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  chip:           { minHeight: 40, paddingHorizontal: SPACING.md, justifyContent: 'center', borderRadius: RADIUS.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:       { fontSize: FONT.base, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  input:          { width: 120, minHeight: 44, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.input, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm + 4, fontSize: FONT.md, color: colors.text, marginBottom: SPACING.xs },
  result:         { backgroundColor: colors.card, borderRadius: RADIUS.md, padding: SPACING.md, gap: 2 },
  resultValue:    { fontSize: FONT.xxl, fontWeight: '800', color: colors.primary },
}));
