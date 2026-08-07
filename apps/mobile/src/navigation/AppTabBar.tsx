import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { useResponsive, SIDEBAR_WIDTH } from '../lib/useResponsive';
import { COLORS, FONT, SPACING, RADIUS } from '../constants/theme';

const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap; label: string }> = {
  Dashboard: { active: 'home',     inactive: 'home-outline',     label: 'Início'   },
  Tasks:     { active: 'checkbox', inactive: 'checkbox-outline', label: 'Tarefas'  },
  Groups:    { active: 'people',   inactive: 'people',           label: 'Grupos'   },
  Ranking:   { active: 'trophy',   inactive: 'trophy-outline',   label: 'Ranking'  },
  Profile:   { active: 'person',   inactive: 'person-outline',   label: 'Perfil'   },
};

// Itens extras que no web ficam na sidebar mas no mobile vivem fora da tab bar
// (acessados via menu do Perfil) — na sidebar larga, mostramos igual ao web.
const EXTRA_ITEMS: { screen: 'Achievements' | 'Statistics'; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { screen: 'Achievements', icon: 'trophy-outline',       label: 'Conquistas'   },
  { screen: 'Statistics',   icon: 'stats-chart-outline',  label: 'Estatísticas' },
];

/**
 * Tab bar responsiva — barra inferior em telas estreitas (celular),
 * sidebar fixa à esquerda em telas largas (desktop), espelhando
 * apps/web/src/components/Sidebar.tsx. Mesmo state/navigation do
 * React Navigation dirigem os dois modos.
 */
export default function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { isWide } = useResponsive();
  const { user, logout } = useAuthStore();

  if (!isWide) {
    // ---- Modo celular: barra inferior (comportamento original) ----
    return (
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 4 }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          const focused = state.index === index;
          const icons = TAB_ICONS[route.name];

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={styles.bottomItem} activeOpacity={0.7}>
              <Ionicons
                name={focused ? icons?.active ?? 'ellipse' : icons?.inactive ?? 'ellipse-outline'}
                size={22}
                color={focused ? COLORS.lime : COLORS.navText}
              />
              <Text style={[styles.bottomLabel, { color: focused ? COLORS.lime : COLORS.navText }]}>
                {String(options.title ?? route.name)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // ---- Modo desktop: sidebar fixa à esquerda ----
  const handleLogout = () => void logout();

  return (
    <View style={[styles.sidebar, { paddingTop: insets.top + SPACING.md }]}>
      <Text style={styles.logo}>ProdScore</Text>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.navSection}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key]!;
            const focused = state.index === index;
            const icons = TAB_ICONS[route.name];

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };

            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={[styles.navItem, focused && styles.navItemActive]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={focused ? icons?.active ?? 'ellipse' : icons?.inactive ?? 'ellipse-outline'}
                  size={18}
                  color={focused ? COLORS.lime : COLORS.navText}
                />
                <Text style={[styles.navLabel, focused && styles.navLabelActive]}>
                  {String(options.title ?? route.name)}
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.navDivider} />

          {EXTRA_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.screen}
              style={styles.navItem}
              activeOpacity={0.7}
              onPress={() => navigation.getParent()?.navigate(item.screen)}
            >
              <Ionicons name={item.icon} size={18} color={COLORS.navText} />
              <Text style={styles.navLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Card do usuário + sair */}
      <View style={styles.userSection}>
        <View style={styles.userRow}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{user?.username?.charAt(0).toUpperCase() ?? 'U'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>{user?.username ?? 'Usuário'}</Text>
            <Text style={styles.userLevel}>Nível {user?.level ?? 1}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color={COLORS.navMuted} />
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Celular
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.navBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.navBorder,
    paddingTop: 6,
  },
  bottomItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  bottomLabel: { fontSize: 11, fontWeight: '600' },

  // Desktop
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: COLORS.navBg,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  logo: { fontSize: FONT.lg, fontWeight: '800', color: '#fff', marginBottom: SPACING.lg, paddingHorizontal: SPACING.xs },
  navSection: { gap: 2 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 10,
  },
  navItemActive: { backgroundColor: COLORS.navActive },
  navLabel: { fontSize: FONT.sm, fontWeight: '500', color: COLORS.navText },
  navLabelActive: { color: '#fff' },
  navDivider: { height: 1, backgroundColor: COLORS.navBorder, marginVertical: SPACING.sm },

  userSection: { borderTopWidth: 1, borderTopColor: COLORS.navBorder, paddingTop: SPACING.sm, gap: 4 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.xs, paddingVertical: SPACING.xs },
  userAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.navActive, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: '#fff', fontWeight: '700', fontSize: FONT.sm },
  userName: { fontSize: FONT.sm, fontWeight: '600', color: '#fff' },
  userLevel: { fontSize: 11, color: COLORS.navMuted },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.xs, paddingVertical: 8 },
  logoutText: { fontSize: FONT.sm, color: COLORS.navMuted, fontWeight: '500' },
});
