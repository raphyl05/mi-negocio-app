import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import MoneyDisplay from '../../components/MoneyDisplay';
import Screen from '../../components/Screen';
import type { Business } from '../../models/business';
import type { CashRegister } from '../../models/cashRegister';
import { getOpenRegister } from '../../services/cashRegisterService';
import { getBusiness } from '../../services/setupService';
import { useTheme } from '../../theme';
import { formatTime } from '../../utils/datetime';

export default function SettingsScreen() {
  const { colors, spacing, typography } = useTheme();
  const [business, setBusiness] = useState<Business | null>(null);
  const [register, setRegister] = useState<CashRegister | null>(null);

  useFocusEffect(
    useCallback(() => {
      getBusiness().then(setBusiness);
      getOpenRegister().then(setRegister);
    }, []),
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text
          style={[
            styles.pageTitle,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          Más
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          MI NEGOCIO
        </Text>
        <Card style={styles.cardGap}>
          <View style={styles.rowIcon}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="storefront-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>
                {business?.name ?? 'Sin configurar'}
              </Text>
              {business?.ownerName ? (
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                  {business.ownerName}
                </Text>
              ) : null}
            </View>
          </View>
          {business?.address ? (
            <Text style={[styles.detail, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              {business.address}
            </Text>
          ) : null}
          {business?.phone ? (
            <Text style={[styles.detail, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              {business.phone}
            </Text>
          ) : null}
        </Card>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          CAJA
        </Text>
        <Card style={styles.cardGap}>
          {register ? (
            <>
              <View style={styles.rowIcon}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="cash-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>
                    Caja abierta
                  </Text>
                  <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                    Desde las {formatTime(register.openedAt)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.detail, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
                Efectivo inicial <MoneyDisplay cents={register.openingAmountCents} />
              </Text>
            </>
          ) : (
            <View style={styles.rowIcon}>
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>
                  Caja cerrada
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                  Ábrela desde la pestaña Inicio
                </Text>
              </View>
            </View>
          )}
        </Card>

        <Text style={[styles.footer, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          Cierre de caja y resumen del día llegan en la Fase 14
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  pageTitle: {
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: 8,
  },
  cardGap: {
    marginBottom: 20,
    gap: 12,
  },
  rowIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontWeight: '600',
  },
  rowSubtitle: {
    marginTop: 2,
  },
  detail: {
    marginLeft: 54,
  },
  footer: {
    textAlign: 'center',
    marginTop: 8,
  },
});