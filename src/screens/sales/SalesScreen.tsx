import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import EmptyState from '../../components/EmptyState';
import MoneyDisplay from '../../components/MoneyDisplay';
import Screen from '../../components/Screen';
import type { Order } from '../../models/order';
import { orderRepository } from '../../repositories/orderRepository';
import { useTheme } from '../../theme';
import { formatTime } from '../../utils/datetime';

export default function SalesScreen() {
  const { colors, spacing, typography } = useTheme();
  const [pending, setPending] = useState<Order[]>([]);

  const load = useCallback(async () => {
    setPending(await orderRepository.listPending());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          Órdenes guardadas
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
          {pending.length} {pending.length === 1 ? 'pendiente' : 'pendientes'}
        </Text>
      </View>

      {pending.length === 0 ? (
        <EmptyState
          icon="hourglass-outline"
          title="No hay órdenes guardadas"
          subtitle="Guarda una venta desde Cobrar > Guardar orden y la verás aquí."
        />
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <PendingRow order={item} />}
          ListFooterComponent={
            <Text style={[styles.footer, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              En la próxima fase podrás ver, editar, cobrar o eliminar cada orden guardada.
            </Text>
          }
        />
      )}
    </Screen>
  );
}

function PendingRow({ order }: { order: Order }) {
  const { colors, spacing, typography } = useTheme();
  const hasCustomer = Boolean(order.customer.customerName.trim());

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderRadius: 16 }]}>
      <View style={[styles.numberBadge, { backgroundColor: colors.warning + '1F' }]}>
        <Text style={{ color: colors.warning, fontSize: typography.sizes.caption, fontWeight: '800' }}>
          #{order.number}
        </Text>
      </View>
      <View style={styles.rowInfo}>
        <Text
          numberOfLines={1}
          style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }}
        >
          {hasCustomer ? order.customer.customerName : 'Venta sin cliente'}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
          {formatTime(order.createdAt)}
        </Text>
      </View>
      <MoneyDisplay cents={order.subtotalCents} size="small" />
      <Ionicons name="time" size={16} color={colors.warning} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    marginBottom: 16,
  },
  title: {
    letterSpacing: -0.5,
  },
  list: {
    paddingHorizontal: 24,
    gap: 10,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  numberBadge: {
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  rowInfo: {
    flex: 1,
  },
  footer: {
    textAlign: 'center',
    marginTop: 12,
  },
});