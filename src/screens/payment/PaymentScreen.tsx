import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MoneyDisplay from '../../components/MoneyDisplay';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import { useCart } from '../../contexts/CartContext';
import type { Order } from '../../models/order';
import type { RootStackParamList } from '../../navigation/types';
import { orderRepository } from '../../repositories/orderRepository';
import { useTheme } from '../../theme';
import { buildOrder } from '../../utils/order';

export default function PaymentScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, subtotalCents, customer, clear } = useCart();
  const [saving, setSaving] = useState(false);
  const [savedOrder, setSavedOrder] = useState<Order | null>(null);

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      const order = buildOrder({ items, customer, status: 'pending' });
      const saved = await orderRepository.save(order);
      clear();
      setSavedOrder(saved);
    } finally {
      setSaving(false);
    }
  };

  const handleBackToHome = () => {
    navigation.popToTop();
  };

  if (savedOrder) {
    return (
      <Screen>
        <View style={styles.center}>
          <View style={[styles.successIcon, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="bookmark" size={44} color={colors.primary} />
          </View>
          <Text
            style={[
              styles.successTitle,
              { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
            ]}
          >
            Orden guardada
          </Text>
          <Text style={[styles.successText, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
            La orden {savedOrder.number} quedó guardada sin pagar. Podrás cobrarla o editarla desde "Órdenes
            guardadas" (Fase 12).
          </Text>
          <View style={styles.btnWrap}>
            <PrimaryButton label="Volver al inicio" onPress={handleBackToHome} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          Cobrar
        </Text>

        <View style={[styles.summary, { backgroundColor: colors.surface, borderRadius: 16 }]}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
            {items.length} LÍNEAS · {items.reduce((total, item) => total + item.quantity, 0)} PRODUCTOS
          </Text>
          <MoneyDisplay cents={subtotalCents} size="large" />
          {customer.customerName ? (
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, marginTop: 8 }}>
              {customer.customerName}
            </Text>
          ) : null}
        </View>

        <Text style={[styles.actionsLabel, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
          ¿Cómo quieres continuar?
        </Text>

        <PrimaryButton label="Cobrar" onPress={() => navigation.navigate('PaymentMethod')} />
        <View style={styles.actionsGap} />
        <PrimaryButton label="Guardar orden" variant="outline" onPress={handleSaveOrder} loading={saving} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  title: {
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  summary: {
    padding: 20,
    marginBottom: 24,
  },
  summaryLabel: {
    letterSpacing: 1,
    marginBottom: 8,
  },
  actionsLabel: {
    marginBottom: 12,
  },
  actionsGap: {
    marginTop: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    letterSpacing: -0.5,
  },
  successText: {
    textAlign: 'center',
    lineHeight: 22,
  },
  btnWrap: {
    alignSelf: 'stretch',
    marginTop: 16,
  },
});