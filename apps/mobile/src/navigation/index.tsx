import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../store/authStore';

// Telas de autenticação
import LoginScreen    from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// Telas principais
import DashboardScreen from '../screens/DashboardScreen';
import TasksScreen     from '../screens/TasksScreen';
import GroupsScreen    from '../screens/GroupsScreen';
import RankingScreen   from '../screens/RankingScreen';
import ProfileScreen   from '../screens/ProfileScreen';

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

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTab    = createBottomTabNavigator<TabParamList>();

// ---------------------------------------------------------------------------
// Tab navigator — telas autenticadas
// ---------------------------------------------------------------------------

function AppTabNavigator() {
  return (
    <AppTab.Navigator
      screenOptions={({ route }) => ({
        headerShown:   false,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor:  COLORS.border,
          borderTopWidth:  1,
          paddingBottom:   4,
          height:          60,
        },
        tabBarActiveTintColor:   COLORS.emerald,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Dashboard') iconName = focused ? 'home'         : 'home-outline';
          if (route.name === 'Tasks')     iconName = focused ? 'checkbox'     : 'checkbox-outline';
          if (route.name === 'Groups')    iconName = focused ? 'people'       : 'people-outline';
          if (route.name === 'Ranking')   iconName = focused ? 'trophy'       : 'trophy-outline';
          if (route.name === 'Profile')   iconName = focused ? 'person'       : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
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
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();

  // Restaura sessão do SecureStore na montagem do app
  useEffect(() => {
    void loadSession();
  }, []);

  // Tela de splash enquanto carrega sessão
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.emerald} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppTabNavigator /> : <AuthStackNavigator />}
    </NavigationContainer>
  );
}
