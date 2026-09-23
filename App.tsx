import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { CartProvider } from './src/contexts/CartContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { PendingOrdersProvider } from './src/contexts/PendingOrdersContext';
import RootNavigator from './src/navigation/RootNavigator';
import LoginScreen from './src/screens/login/LoginScreen';
import SetupScreen from './src/screens/setup/SetupScreen';
import ToastHost from './src/components/ToastHost';
import { printerService } from './src/services/printerService';
import { isSetupDone } from './src/services/setupService';
import { initStorageMaintenance, runStartupStorageMaintenance } from './src/services/storageMaintenance';
import { useAutoSync } from './src/hooks/useAutoSync';
import { ThemeProvider, useTheme } from './src/theme';

function SyncEngine() {
  useAutoSync();
  return null;
}

type BootStatus = 'loading' | 'setup' | 'ready';

function BootGate() {
  const { colors, typography } = useTheme();
  const { session } = useAuth();
  const [status, setStatus] = useState<BootStatus>('loading');

  useEffect(() => {
    printerService.init();
    initStorageMaintenance();
    runStartupStorageMaintenance();
    isSetupDone().then(() => setStatus('ready'));
  }, [session]);

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

  return (
    <>
      {session && !session.offline ? <SyncEngine /> : null}
      {!session ? <LoginScreen onLogin={() => {}} onCreateAccount={() => setStatus('setup')} /> : <RootNavigator />}
    </>
  );
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
          <NotificationProvider>
            <CartProvider>
              <PendingOrdersProvider>
                <ThemedApp />
                <ToastHost />
              </PendingOrdersProvider>
            </CartProvider>
          </NotificationProvider>
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