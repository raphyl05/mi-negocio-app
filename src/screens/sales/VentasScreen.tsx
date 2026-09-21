import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import CalendarModal from '../../components/CalendarModal';
import EmptyState from '../../components/EmptyState';
import MoneyDisplay from '../../components/MoneyDisplay';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import TicketPreviewModal from '../../components/TicketPreviewModal';
import type { CashRegister } from '../../models/cashRegister';
import type { Business } from '../../models/business';
import type { Order } from '../../models/order';
import type { RootStackParamList, TabParamList } from '../../navigation/types';
import { getOpenRegister } from '../../services/cashRegisterService';
import { orderRepository } from '../../repositories/orderRepository';
import { getBusiness } from '../../services/setupService';
import { buildTicket } from '../../services/printerService';
import { orderService } from '../../services/orderService';
import { usePrinter } from '../../hooks/usePrinter';
import { useTheme } from '../../theme';
import { formatTime, inDateRange, parseDateInput } from '../../utils/datetime';
import { isOrderInRegister } from '../../utils/cashClosure';
import { invoiceCodeFor } from '../../utils/invoice';
import { filterOrders } from '../../utils/orderSearch';

type Segment = 'pending' | 'paid';

function formatDateInput(date: Date): string {
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

type VentasNav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Sales'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function VentasScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<VentasNav>();
  const [segment, setSegment] = useState<Segment>('pending');
  const [orders, setOrders] = useState<Order[]>([]);
  const [queryGuardadas, setQueryGuardadas] = useState('');
  const [queryCobradas, setQueryCobradas] = useState('');
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to'>('from');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [business, setBusiness] = useState<Business | null>(null);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [register, setRegister] = useState<CashRegister | null>(null);
  const [checked, setChecked] = useState(false);
  const { available } = usePrinter();

  const load = useCallback(async () => {
    const [businessData, allOrders, openRegister] = await Promise.all([
      getBusiness(),
      orderRepository.listAll(),
      getOpenRegister(),
    ]);
    setBusiness(businessData);
    setOrders(allOrders);
    setRegister(openRegister);
    setSelected(new Set());
    setSelecting(false);
    setChecked(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setQueryGuardadas('');
      setQueryCobradas('');
      setFromText('');
      setToText('');
      setSelected(new Set());
      setSelecting(false);
      load();
    }, [load]),
  );

  const hasRange = fromText.trim().length > 0 || toText.trim().length > 0;

  const pending = useMemo(() => orders.filter((order) => order.status === 'pending'), [orders]);
  const paid = useMemo(() => orders.filter((order) => order.status === 'paid'), [orders]);
  const voided = useMemo(() => orders.filter((order) => order.status === 'voided'), [orders]);

  const filteredPending = useMemo(() => {
    const textMatch = filterOrders(pending, queryGuardadas);
    if (!selecting && textMatch.length === pending.length) return pending;
    return textMatch;
  }, [pending, queryGuardadas, selecting]);

  const filteredPaid = useMemo(() => {
    const base = hasRange
      ? paid.filter((order) => {
          const from = parseDateInput(fromText);
          const to = parseDateInput(toText);
          return inDateRange(order.createdAt, from ?? undefined, to ?? undefined);
        })
      : register
        ? paid.filter((order) => isOrderInRegister(order, register.openedAt))
        : paid;
    const withVoided = hasRange
      ? [
          ...base,
          ...voided.filter((order) => {
            const from = parseDateInput(fromText);
            const to = parseDateInput(toText);
            return inDateRange(order.createdAt, from ?? undefined, to ?? undefined);
          }),
        ]
      : [...base, ...voided];
    return filterOrders(withVoided, queryCobradas);
  }, [paid, voided, queryCobradas, fromText, toText, hasRange, register]);

  const switchSegment = (next: Segment) => {
    setSegment(next);
    setQueryGuardadas('');
    setQueryCobradas('');
    setFromText('');
    setToText('');
    setSelected(new Set());
    setSelecting(false);
  };

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

  const applySingle = (target: 'from' | 'to', value: Date) => {
    if (target === 'from') {
      setFromText(formatDateInput(value));
      const to = parseDateInput(toText);
      if (to && to < value) setToText(formatDateInput(value));
    } else {
      setToText(formatDateInput(value));
      const from = parseDateInput(fromText);
      if (from && from > value) setFromText(formatDateInput(value));
    }
  };

  const clearField = (target: 'from' | 'to') => {
    if (target === 'from') setFromText('');
    else setToText('');
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
            for (const id of selected) {
              await orderService.cancelPendingOrder(id);
            }
            await load();
          },
        },
      ],
    );
  };

  const handlePrint = (order: Order) => {
    if (!business) {
      Alert.alert('Sin configurar', 'Configura los datos del negocio primero.');
      return;
    }
    setPreviewOrder(order);
  };

  const showPending = segment === 'pending';
  const list = showPending ? filteredPending : filteredPaid;
  const showSearchControls = showPending ? pending.length > 0 : paid.length > 0 || hasRange;

  if (!checked) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!register) {
    return (
      <Screen>
        <View style={styles.locked}>
          <View style={[styles.lockedIcon, { backgroundColor: colors.warning + '1F' }]}>
            <Ionicons name="lock-closed" size={36} color={colors.warning} />
          </View>
          <Text
            style={[
              styles.lockedTitle,
              { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
            ]}
          >
            Caja cerrada
          </Text>
          <Text style={[styles.lockedSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
            Las ventas se desbloquean al abrir la caja desde Inicio. Mientras tanto solo puedes editar el inventario.
          </Text>
          <View style={styles.lockedAction}>
            <PrimaryButton label="Abrir caja" onPress={() => navigation.navigate('Home')} />
          </View>
        </View>
      </Screen>
    );
  }

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
            ? `${list.length} ${list.length === 1 ? 'venta guardada' : 'ventas guardadas'} · las pendientes siempre se conservan`
            : `${list.length} ${list.length === 1 ? 'venta' : 'ventas'} cobradas · ${hasRange ? 'rango seleccionado' : 'esta caja'}`}
        </Text>
      </View>

      <View style={styles.segmentRow}>
        <SegmentButton label="Guardadas" count={pending.length} active={segment === 'pending'} onPress={() => switchSegment('pending')} />
        <SegmentButton label="Cobradas" count={paid.length + voided.length} active={segment === 'paid'} onPress={() => switchSegment('paid')} />
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

      {showSearchControls ? (
        <View style={styles.search}>
          <TextInput
            value={showPending ? queryGuardadas : queryCobradas}
            onChangeText={showPending ? setQueryGuardadas : setQueryCobradas}
            placeholder={showPending ? 'Buscar por nombre, teléfono, código…' : 'Buscar por cliente, teléfono, código…'}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
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
            <View style={styles.rangeRow}>
              <Pressable
                onPress={() => {
                  setPickerTarget('from');
                  setCalendarOpen(true);
                }}
                style={[styles.rangeField, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={{ color: fromText ? colors.textPrimary : colors.textSecondary, fontSize: typography.sizes.body, fontWeight: fromText ? '700' : '400' }}>
                  {fromText || 'Desde'}
                </Text>
              </Pressable>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>a</Text>
              <Pressable
                onPress={() => {
                  setPickerTarget('to');
                  setCalendarOpen(true);
                }}
                style={[styles.rangeField, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={{ color: toText ? colors.textPrimary : colors.textSecondary, fontSize: typography.sizes.body, fontWeight: toText ? '700' : '400' }}>
                  {toText || 'Hasta'}
                </Text>
              </Pressable>
              {hasRange ? (
                <Pressable
                  onPress={() => {
                    setFromText('');
                    setToText('');
                  }}
                  hitSlop={8}
                  style={styles.rangeClear}
                >
                  <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
                </Pressable>
              ) : null}
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
            title={hasRange ? 'Sin resultados para el rango' : 'Sin ventas cobradas en esta caja'}
            subtitle={
              hasRange
                ? 'Prueba con otro rango de fechas usando el calendario.'
                : 'Las ventas pagadas de la caja actual aparecen aquí. Usa el rango de fechas para buscar días anteriores.'
            }
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
                onPrint={handlePrint}
              />
            ) : (
              <PaidRow order={item} isVoided={item.status === 'voided'} onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })} onPrint={handlePrint} />
            )
          }
          ListFooterComponent={
            <Text style={[styles.footer, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              {showPending
                ? 'Toca una orden para verla, editarla o cobrarla. Mantenla presionada para seleccionar varias.'
                : 'Toca una venta para ver su detalle o imprimir el ticket rápido.'}
            </Text>
          }
        />
      )}

      {previewOrder && business ? (
        <TicketPreviewModal
          visible={true}
          ticket={buildTicket(previewOrder, business)}
          onClose={() => setPreviewOrder(null)}
        />
      ) : null}

      <CalendarModal
        visible={calendarOpen}
        mode="single"
        title={pickerTarget === 'from' ? 'Fecha desde' : 'Fecha hasta'}
        singleValue={pickerTarget === 'from' ? fromText : toText}
        onApply={(from) => applySingle(pickerTarget, from)}
        onClear={() => clearField(pickerTarget)}
        onClose={() => setCalendarOpen(false)}
      />
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
  onPrint,
}: {
  order: Order;
  selecting: boolean;
  checked: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onPrint: (order: Order) => void;
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
          <Text style={{ color: colors.warning, fontSize: typography.sizes.caption, fontWeight: '800' }}>{invoiceCodeFor(order.number)}</Text>
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
      {!selecting ? (
        <>
          <Pressable onPress={(e) => { e.stopPropagation(); onPrint(order); }} hitSlop={8} style={styles.printIcon}>
            <Ionicons name="print-outline" size={18} color={colors.primary} />
          </Pressable>
          <Ionicons name="chevron-forward" size={16} color={colors.warning} />
        </>
      ) : null}
    </Pressable>
  );
}

function PaidRow({ order, isVoided, onPress, onPrint }: { order: Order; isVoided: boolean; onPress: () => void; onPrint: (order: Order) => void }) {
  const { colors, spacing, typography } = useTheme();
  const hasCustomer = Boolean(order.customer.customerName.trim());

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderRadius: 16, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.numberBadge, { backgroundColor: isVoided ? colors.danger + '1F' : colors.success + '1F' }]}>
        <Text style={{ color: isVoided ? colors.danger : colors.success, fontSize: typography.sizes.caption, fontWeight: '800' }}>
          {isVoided ? 'Anulada' : invoiceCodeFor(order.number)}
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
          {formatTime(order.createdAt)} · {isVoided ? 'Anulada' : 'Pagada'}
        </Text>
      </View>
      <MoneyDisplay cents={order.subtotalCents} size="small" />
      <Pressable onPress={(e) => { e.stopPropagation(); onPrint(order); }} hitSlop={8} style={styles.printIcon}>
        <Ionicons name="print-outline" size={18} color={colors.primary} />
      </Pressable>
      <Ionicons name="close-circle" size={16} color={isVoided ? colors.danger : colors.success} />
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
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  rangeField: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  rangeClear: {
    padding: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locked: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
  },
  lockedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  lockedTitle: {
    letterSpacing: -0.5,
  },
  lockedSubtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  lockedAction: {
    alignSelf: 'stretch',
    marginTop: 16,
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
    minWidth: 72,
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
  printIcon: {
    padding: 4,
    marginRight: -4,
    borderRadius: 8,
  },
  footer: {
    textAlign: 'center',
    marginTop: 12,
  },
});