import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import MoneyDisplay from '../../components/MoneyDisplay';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import { useTheme } from '../../theme';

export default function HomeScreen() {
  const { colors, spacing, typography } = useTheme();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.brand}>
            <Text
              style={[
                styles.brandName,
                { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
              ]}
            >
              MiCaja
            </Text>
            <Text style={[styles.brandTagline, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
              Tu caja registradora móvil
            </Text>
          </View>

          <Card>
            <Text style={[styles.cardLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              VENTAS DE HOY
            </Text>
            <MoneyDisplay cents={485000} size="large" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text
              style={{
                color: colors.primary,
                fontSize: typography.sizes.body,
                fontWeight: typography.weights.semibold,
              }}
            >
              34 ventas · Caja abierta
            </Text>
          </Card>

          <PrimaryButton label="Ver carrito" onPress={() => {}} />
        </View>

        <Text style={[styles.footer, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          Fase 3 — Facturación llegará en la Fase 7
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 16,
  },
  brand: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  brandName: {
    letterSpacing: -0.5,
  },
  brandTagline: {
    marginTop: 4,
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
    marginTop: 8,
    marginBottom: 24,
  },
});