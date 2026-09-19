import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import EmptyState from '../../components/EmptyState';
import MoneyDisplay from '../../components/MoneyDisplay';
import Screen from '../../components/Screen';
import type { Order } from '../../models/order';
import type { RootStackParamList } from '../../navigation/types';
import { orderRepository } from '../../repositories/orderRepository';
import { useTheme } from '../../theme';
import { formatTime, inDateRange, parseDateInput } from '../../utils/datetime';
import { filterOrders } from '../../utils/orderSearch';

type Segment = 'pending' | 'paid';

export default function VentasScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [segment, setSegment] = useState<Segment>('pending');
  const [pending, setPending] = useState<Order[]>([]);
  const [paid, setPaid] = useState<Order[]>([]);
  const [query, setQuery] = useState('');
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [pendingOrders, paidOrders] = await Promise.all([orderRepository.listPending(), orderRepository.listPaid()]);
    setPending(pendingOrders);
    setPaid(paidOrders);
    setSelected(new Set());
    setSelecting(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setQuery('');
      setFromText('');
      setToText('');
      load();
    }, [load]),
  );

  const filteredPending = useMemo(() => {
    const textMatch = filterOrders(pending, query);
    if (!selecting && textMatch.length === pending.length) return pending;
    return textMatch;
  }, [pending, query, selecting]);

  const filteredPaid = useMemo(() => {
    const fromDate = parseDateInput(fromText);
    const toDate = parseDateInput(toText);
    const byRange = paid.filter((order) => inDateRange(order.createdAt, fromDate ?? undefined, toDate ?? undefined));
    return filterOrders(byRange, query);
  }, [paid, fromText, toText, query]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const count = selected.size;
    Alert.alert(
      'Eliminar órdenes guardadas',
      `Se eliminarán ${count} órdenes pendientes. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await Promise.all(Array.from(selected).map((id) => orderRepository.remove(id)));
            await load();
          },
        },
      ],
    );
  };

  const showPending = segment === 'pending';
  const list = showPending ? filteredPending : filteredPaid;

  return (
    <Screen>
      <View style={styles.header}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          Ventas
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
          {segment === 'pending'
            ? `${pending.length} ${pending.length === 1 ? 'venta guardada' : 'ventas guardadas'} · las pendientes siempre se conservan`
            : `${paid.length} ${paid.length === 1 ? 'venta' : 'ventas'} cobradas`}
        </Text>
      </View>

      <View style={styles.segmentRow}>
        <SegmentButton label="Guardadas" count={pending.length} active={segment === 'pending'} onPress={() => setSegment('pending')} />
        <SegmentButton label="Cobradas" count={paid.length} active={segment === 'paid'} onPress={() => setSegment('paid')} />
      </View>

      {segment === 'pending' && selecting ? (
        <View style={styles.selectBar}>
          <Pressable
            onPress={() => {
              setSelected(new Set());
              setSelecting(false);
            }}
            hitSlop={8}
            style={styles.selectAction}
          >
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body, fontWeight: '600' }}>Cancelar</Text>
          </Pressable>
          <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }}>
            {selected.size} {selected.size === 1 ? 'seleccionada' : 'seleccionadas'}
          </Text>
          <Pressable
            onPress={handleDeleteSelected}
            disabled={selected.size === 0}
            hitSlop={8}
            style={[styles.selectAction, selected.size === 0 ? { opacity: 0.4 } : null]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={{ color: colors.danger, fontSize: typography.sizes.body, fontWeight: '700' }}>Eliminar</Text>
          </Pressable>
        </View>
      ) : null}

      {list.length > 0 ? (
        <View style={styles.search}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={showPending ? 'Buscar por nombre, teléfono, #orden…' : 'Buscar por cliente, teléfono, #orden…'}
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
          {!showPending ? (
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, marginBottom: 4 }}>Desde</Text>
                <TextInput
                  value={fromText}
                  onChangeText={setFromText}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
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
              <View style={styles.dateField}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, marginBottom: 4 }}>Hasta</Text>
                <TextInput
                  value={toText}
                  onChangeText={setToText}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
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
            </View>
          ) : null}
        </View>
      ) : null}

      {list.length === 0 ? (
        showPending ? (
          <EmptyState
            icon="hourglass-outline"
            title="No hay órdenes guardadas"
            subtitle="Guarda una venta desde Cobrar > Guardar orden y se conservará aquí hasta que la cobres."
          />
        ) : (
          <EmptyState
            icon="time-outline"
            title="Sin ventas cobradas"
            subtitle="Las ventas pagadas aparecen aquí con su detalle y ticket."
          />
        )
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) =>
            showPending ? (
              <PendingRow
                order={item}
                selecting={selecting}
                checked={selected.has(item.id)}
                onPress={() => {
                  if (selecting) {
                    toggleSelect(item.id);
                  } else {
                    navigation.navigate('OrderDetail', { orderId: item.id });
                  }
                }}
                onLongPress={() => {
                  setSelecting(true);
                  setSelected(new Set([item.id]));
                }}
              />
            ) : (
              <PaidRow order={item} onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })} />
            )
          }
          ListFooterComponent={
            <Text style={[styles.footer, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              {showPending
                ? 'Toca una orden para verla, editarla o cobrarla. Mantenla presionada para seleccionar varias.'
                : 'Toca una venta para ver su detalle o reimprimir el ticket.'}
            </Text>
          }
        />
      )}
    </Screen>
  );
}

function SegmentButton({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.segmentButton,
        {
          backgroundColor: active ? colors.primary : colors.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: active ? colors.textOnPrimary : colors.textSecondary,
          fontSize: typography.sizes.body,
          fontWeight: typography.weights.semibold,
        }}
      >
        {label}
      </Text>
      <View
        style={[
          styles.segmentCount,
          {
            backgroundColor: active ? colors.textOnPrimary + '22' : colors.surfaceMuted,
          },
        ]}
      >
        <Text style={{ color: active ? colors.textOnPrimary : colors.textSecondary, fontSize: typography.sizes.caption, fontWeight: '700' }}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function PendingRow({
  order,
  selecting,
  checked,
  onPress,
  onLongPress,
}: {
  order: Order;
  selecting: boolean;
  checked: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  const hasCustomer = Boolean(order.customer.customerName.trim());

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderRadius: 16,
          opacity: pressed ? 0.85 : 1,
          borderWidth: checked ? 2 : 1,
          borderColor: checked ? colors.primary : colors.border + '55',
        },
      ]}
    >
      {selecting ? (
        <View
          style={[
            styles.checkbox,
            {
              borderColor: checked ? colors.primary : colors.border,
              backgroundColor: checked ? colors.primary : 'transparent',
            },
          ]}
        >
          {checked ? <Ionicons name="checkmark" size={16} color={colors.textOnPrimary} /> : null}
        </View>
      ) : (
        <View style={[styles.numberBadge, { backgroundColor: colors.warning + '1F' }]}>
          <Text style={{ color: colors.warning, fontSize: typography.sizes.caption, fontWeight: '800' }}>#{order.number}</Text>
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text
          numberOfLines={1}
          style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }}
        >
          {hasCustomer ? order.customer.customerName : 'Venta sin cliente'}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
          {formatTime(order.createdAt)} · Pendiente
        </Text>
      </View>
      <MoneyDisplay cents={order.subtotalCents} size="small" />
      {!selecting ? <Ionicons name="chevron-forward" size={16} color={colors.warning} /> : null}
    </Pressable>
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
        <Text style={{ color: colors.success, fontSize: typography.sizes.caption, fontWeight: '800' }}>#{order.number}</Text>
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
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 8,
  },
  segmentCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginBottom: 6,
  },
  selectAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  dateField: {
    flex: 1,
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
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
  },
  footer: {
    textAlign: 'center',
    marginTop: 12,
  },
});