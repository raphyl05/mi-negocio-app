import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/login/LoginScreen';
import SetupScreen from './src/screens/setup/SetupScreen';
import { isSetupDone } from './src/services/setupService';
import { ThemeProvider, useTheme } from './src/theme';

function BootGate() {
  const { colors, typography } = useTheme();
  const [status, setStatus] = useState<'loading' | 'setup' | 'configured'>('loading');

  useEffect(() => {
    isSetupDone().then((done) => setStatus(done ? 'configured' : 'setup'));
  }, []);

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
    return <SetupScreen onCompleted={() => setStatus('configured')} />;
  }

  return <LoginScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="dark" />
        <BootGate />
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