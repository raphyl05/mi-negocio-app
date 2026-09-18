import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import EmptyState from '../../components/EmptyState';
import MoneyDisplay from '../../components/MoneyDisplay';
import Screen from '../../components/Screen';
import type { Order } from '../../models/order';
import type { RootStackParamList } from '../../navigation/types';
import { orderRepository } from '../../repositories/orderRepository';
import { useTheme } from '../../theme';
import { formatTime } from '../../utils/datetime';
import { filterOrders } from '../../utils/orderSearch';

export default function HistoryScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [paid, setPaid] = useState<Order[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setPaid(await orderRepository.listPaid());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = filterOrders(paid, query);

  return (
    <Screen>
      <View style={styles.header}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          Historial
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
          {paid.length} {paid.length === 1 ? 'venta' : 'ventas'} pagadas
        </Text>
      </View>

      {paid.length > 0 ? (
        <View style={styles.search}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por fecha, hora, cliente, nº de orden…"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.searchInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                fontSize: typography.sizes.body,
              },
            ]}
          />
        </View>
      ) : null}

      {paid.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="Sin ventas pagadas"
          subtitle="Las ventas cobradas aparecen aquí con su detalle."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="Sin resultados"
          subtitle="Ninguna venta coincide con tu búsqueda."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <PaidRow order={item} onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })} />
          )}
          ListFooterComponent={
            <Text style={[styles.footer, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              Toca una venta para ver su detalle completo.
            </Text>
          }
        />
      )}
    </Screen>
  );
}

function PaidRow({ order, onPress }: { order: Order; onPress: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const hasCustomer = Boolean(order.customer.customerName.trim());

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderRadius: 16, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.numberBadge, { backgroundColor: colors.success + '1F' }]}>
        <Text style={{ color: colors.success, fontSize: typography.sizes.caption, fontWeight: '800' }}>
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
          {formatTime(order.createdAt)} · Pagada
        </Text>
      </View>
      <MoneyDisplay cents={order.subtotalCents} size="small" />
      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
    </Pressable>
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
  search: {
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 16,
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