import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import MoneyDisplay from '../../components/MoneyDisplay';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import type { Order } from '../../models/order';
import type { RootStackParamList } from '../../navigation/types';
import { orderRepository } from '../../repositories/orderRepository';
import { useTheme } from '../../theme';
import { formatTime } from '../../utils/datetime';
import { formatMoney } from '../../utils/money';

type Props = {
  route: RouteProp<RootStackParamList, 'OrderComplete'>;
};

export default function OrderCompleteScreen({ route }: Props) {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    orderRepository.getById(route.params.orderId).then(setOrder);
  }, [route.params.orderId]);

  if (!order) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const isCash = order.paymentMethod === 'cash';

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.centerCol}>
          <View style={[styles.successIcon, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={44} color={colors.white} />
          </View>
          <Text
            style={[
              styles.title,
              { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
            ]}
          >
            Venta completada
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
            Orden {order.number} · {formatTime(order.createdAt)}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Row label="Método de pago" value={isCash ? 'Efectivo' : 'Transferencia'} />
          {isCash && order.receivedCents !== undefined ? (
            <Row label="Efectivo recibido" value={formatMoney(order.receivedCents)} />
          ) : null}
          {isCash && order.changeCents !== undefined && order.changeCents > 0 ? (
            <Row label="Cambio a devolver" value={formatMoney(order.changeCents)} accent />
          ) : null}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>Total</Text>
            <MoneyDisplay cents={order.subtotalCents} size="large" />
          </View>
        </View>

        <View style={styles.action}>
          <PrimaryButton label="Nueva venta" onPress={() => navigation.popToTop()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>{label}</Text>
      <Text
        style={{
          color: accent ? colors.success : colors.textPrimary,
          fontSize: typography.sizes.body,
          fontWeight: '600',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCol: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    letterSpacing: -0.5,
  },
  subtitle: {},
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  action: {
    marginTop: 24,
  },
});