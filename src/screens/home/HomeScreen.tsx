import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import MoneyDisplay from '../../components/MoneyDisplay';
import Screen from '../../components/Screen';
import type { CashRegister } from '../../models/cashRegister';
import { getOpenRegister } from '../../services/cashRegisterService';
import { useTheme } from '../../theme';
import { formatTime } from '../../utils/datetime';
import OpenCashScreen from '../cash/OpenCashScreen';

export default function HomeScreen() {
  const { colors, spacing, typography } = useTheme();
  const [register, setRegister] = useState<CashRegister | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const reg = await getOpenRegister();
    setRegister(reg);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!register) {
    return <OpenCashScreen onOpened={load} />;
  }

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
              CAJA ABIERTA
            </Text>
            <View style={styles.registerRow}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.registerText, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>
                Abierta desde las {formatTime(register.openedAt)}
              </Text>
            </View>
            <Text style={[styles.registerRow2, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
              Efectivo inicial <MoneyDisplay cents={register.openingAmountCents} />
            </Text>
          </Card>

          <EmptyState
            icon="cart-outline"
            title="Facturación"
            subtitle="La pantalla de facturación llega en la Fase 7. Tu caja ya está lista."
          />

          <Text style={[styles.footer, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
            Fase 6 — Caja abierta
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    marginBottom: 10,
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  registerText: {
    fontWeight: '600',
  },
  registerRow2: {
    marginTop: 6,
  },
  footer: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
});