import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AppNavigation from './src/navigation/index';

/** Ponto de entrada do aplicativo mobile ProdScore */
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#030712" />
        <AppNavigation />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
