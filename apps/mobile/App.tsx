import 'react-native-url-polyfill/auto';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
} from '@expo-google-fonts/montserrat';
import AppNavigation from './src/navigation/index';
import ToastHost from './src/components/ToastHost';
import GamificationPopup from './src/components/GamificationPopup';
import { useThemeColors, useResolvedTheme } from './src/lib/useThemeColors';
import './src/lib/globalFont';

/** Ponto de entrada do aplicativo mobile ProdScore */
export default function App() {
  const colors = useThemeColors();
  const resolvedTheme = useResolvedTheme();
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
        <AppNavigation />
        <ToastHost />
        <GamificationPopup />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
