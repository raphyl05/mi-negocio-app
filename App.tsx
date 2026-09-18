import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Card from './src/components/Card';
import MoneyDisplay from './src/components/MoneyDisplay';
import PrimaryButton from './src/components/PrimaryButton';
import { ThemeProvider, useTheme } from './src/theme';

function BrandPreview() {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.brand, { paddingTop: spacing.xxl }]}>
        <Text
          style={[
            styles.brandName,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          MiCaja
        </Text>
        <Text
          style={[styles.brandTagline, { color: colors.textSecondary, fontSize: typography.sizes.body }]}
        >
          Tu caja registradora móvil
        </Text>
      </View>

      <View style={styles.content}>
        <Card>
          <Text style={[styles.cardLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
            VENTAS DE HOY
          </Text>
          <MoneyDisplay cents={485000} size="large" />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={{ color: colors.primary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }}>
            34 ventas · Caja abierta
          </Text>
        </Card>

        <PrimaryButton label="Iniciar sesión" onPress={() => {}} />
        <PrimaryButton label="Continuar al pago" variant="outline" onPress={() => {}} />
      </View>

      <Text style={[styles.footer, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
        Fase 2 — Sistema visual
      </Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="dark" />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <BrandPreview />
          </ScrollView>
        </SafeAreaView>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 24,
  },
  brand: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  brandName: {
    letterSpacing: -0.5,
  },
  brandTagline: {
    marginTop: 4,
  },
  content: {
    gap: 16,
  },
  cardLabel: {
    letterSpacing: 1,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  footer: {
    textAlign: 'center',
    marginTop: 32,
  },
});