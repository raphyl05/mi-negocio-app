import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { CartProvider } from './src/contexts/CartContext';
import { PendingOrdersProvider } from './src/contexts/PendingOrdersContext';
import RootNavigator from './src/navigation/RootNavigator';
import LoginScreen from './src/screens/login/LoginScreen';
import SetupScreen from './src/screens/setup/SetupScreen';
import { printerService } from './src/services/printerService';
import { isSetupDone } from './src/services/setupService';
import { ThemeProvider, useTheme } from './src/theme';

type BootStatus = 'loading' | 'setup' | 'ready';

function BootGate() {
  const { colors, typography } = useTheme();
  const { authed, login } = useAuth();
  const [status, setStatus] = useState<BootStatus>('loading');

  useEffect(() => {
    printerService.init();
  }, []);

  useEffect(() => {
    isSetupDone().then((done) => setStatus(done ? 'ready' : 'setup'));
  }, [authed]);

  if (status === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.primary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold }}>
          MiCaja
        </Text>
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      </View>
    );
  }

  if (status === 'setup') {
    return <SetupScreen onCompleted={() => setStatus('ready')} />;
  }

  if (!authed) {
    return <LoginScreen onLogin={login} />;
  }

  return <RootNavigator />;
}

function ThemedApp() {
  const { dark } = useTheme();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <BootGate />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <PendingOrdersProvider>
              <ThemedApp />
            </PendingOrdersProvider>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginTop: 16,
  },
});