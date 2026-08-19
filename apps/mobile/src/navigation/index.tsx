import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuthStore } from '../store/authStore';
import AppTabBar from './AppTabBar';

// Telas de autenticação
import LoginScreen     from '../screens/LoginScreen';
import RegisterScreen  from '../screens/RegisterScreen';
import MfaVerifyScreen from '../screens/MfaVerifyScreen';

// Telas principais (tab bar)
import DashboardScreen from '../screens/DashboardScreen';
import TasksScreen     from '../screens/TasksScreen';
import GroupsScreen    from '../screens/GroupsScreen';
import RankingScreen   from '../screens/RankingScreen';
import ProfileScreen   from '../screens/ProfileScreen';

// Telas alcançadas via stack (não ficam na tab bar, espelham rotas do web)
import AchievementsScreen   from '../screens/AchievementsScreen';
import StatisticsScreen     from '../screens/StatisticsScreen';
import GroupDetailScreen    from '../screens/GroupDetailScreen';
import GroupSettingsScreen  from '../screens/GroupSettingsScreen';
import SecurityScreen       from '../screens/SecurityScreen';

import { COLORS } from '../constants/theme';

// ---------------------------------------------------------------------------
// Tipos de navegação
// ---------------------------------------------------------------------------

export type AuthStackParamList = {
  Login:    undefined;
  Register: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Tasks:     undefined;
  Groups:    undefined;
  Ranking:   undefined;
  Profile:   undefined;
};

export type AppStackParamList = {
  Tabs:           undefined;
  Achievements:   undefined;
  Statistics:     undefined;
  GroupDetail:    { groupId: string; groupName: string };
  GroupSettings:  { groupId: string };
  Security:       undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTab    = createBottomTabNavigator<TabParamList>();
const AppStack  = createNativeStackNavigator<AppStackParamList>();

// ---------------------------------------------------------------------------
// Tab navigator — telas autenticadas de primeiro nível
// ---------------------------------------------------------------------------

function AppTabNavigator() {
  return (
    <AppTab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <AppTab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Início'     }} />
      <AppTab.Screen name="Tasks"     component={TasksScreen}     options={{ title: 'Tarefas'    }} />
      <AppTab.Screen name="Groups"    component={GroupsScreen}    options={{ title: 'Grupos'     }} />
      <AppTab.Screen name="Ranking"   component={RankingScreen}   options={{ title: 'Ranking'    }} />
      <AppTab.Screen name="Profile"   component={ProfileScreen}   options={{ title: 'Perfil'     }} />
    </AppTab.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Stack do app autenticado — tabs + telas de segundo nível
// (equivalente às rotas /conquistas, /estatisticas, /grupos/:id, /grupos/:id/configuracoes do web)
// ---------------------------------------------------------------------------

function AppStackNavigator() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Tabs"          component={AppTabNavigator} />
      <AppStack.Screen name="Achievements"  component={AchievementsScreen} />
      <AppStack.Screen name="Statistics"    component={StatisticsScreen} />
      <AppStack.Screen name="GroupDetail"   component={GroupDetailScreen} />
      <AppStack.Screen name="GroupSettings" component={GroupSettingsScreen} />
      <AppStack.Screen name="Security"      component={SecurityScreen} />
    </AppStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Stack de autenticação
// ---------------------------------------------------------------------------

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login"    component={LoginScreen}    />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Navegação raiz — decide entre auth e app conforme o estado de autenticação
// ---------------------------------------------------------------------------

export default function AppNavigation() {
  const { isAuthenticated, isLoading, mfaPending, loadSession } = useAuthStore();

  // Restaura sessão do SecureStore na montagem do app
  useEffect(() => {
    void loadSession();
  }, []);

  // Tela de splash enquanto carrega sessão
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  // Login com senha feito, mas a conta tem 2FA ativo pendente de step-up —
  // não é nem "autenticado" (AppStack) nem a tela de login normal.
  if (mfaPending) {
    return (
      <NavigationContainer>
        <MfaVerifyScreen />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppStackNavigator /> : <AuthStackNavigator />}
    </NavigationContainer>
  );
}
