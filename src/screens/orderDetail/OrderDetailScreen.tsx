import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MoneyDisplay from '../../components/MoneyDisplay';
import PrimaryButton from '../../components/PrimaryButton';
import ProductImage from '../../components/ProductImage';
import Screen from '../../components/Screen';
import { useCart } from '../../contexts/CartContext';
import type { Order } from '../../models/order';
import type { RootStackParamList } from '../../navigation/types';
import { orderRepository } from '../../repositories/orderRepository';
import { getBusiness } from '../../services/setupService';
import { buildTicket, renderTicketText } from '../../services/printerService';
import { useTheme } from '../../theme';
import { formatDate, formatTime } from '../../utils/datetime';
import { formatMoney } from '../../utils/money';

type Props = {
  route: RouteProp<RootStackParamList, 'OrderDetail'>;
};

export default function OrderDetailScreen({ route }: Props) {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { restore } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState('Mi Negocio');
  const [ticketVisible, setTicketVisible] = useState(false);

  useEffect(() => {
    getBusiness().then((business) => {
      if (business?.name) setBusinessName(business.name);
    });
  }, []);

  const load = useCallback(async () => {
    const found = await orderRepository.getById(route.params.orderId);
    setOrder(found);
    setLoading(false);
  }, [route.params.orderId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleEdit = async () => {
    if (!order) return;
    restore(order.items, order.customer);
    await orderRepository.remove(order.id);
    navigation.replace('Cart');
  };

  const handleDelete = () => {
    if (!order) return;
    Alert.alert('Eliminar orden', `Se eliminará la orden #${order.number}. Esta acción no se puede deshacer.`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await orderRepository.remove(order.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleBack = () => navigation.goBack();

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body, textAlign: 'center' }}>
            Esta orden ya no existe.
          </Text>
          <View style={styles.backWrap}>
            <PrimaryButton label="Volver" onPress={handleBack} />
          </View>
        </View>
      </Screen>
    );
  }

  const hasCustomer = Boolean(
    order.customer.customerName.trim() || order.customer.phone || order.customer.address || order.customer.description,
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={[styles.backButton, { backgroundColor: colors.surfaceMuted }]} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text
              style={[
                styles.title,
                { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
              ]}
            >
              Orden #{order.number}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
              {formatDate(order.createdAt)} · {formatTime(order.createdAt)}
            </Text>
          </View>
          <View
            style={[
              styles.statusChip,
              { backgroundColor: order.status === 'paid' ? colors.success + '1F' : colors.warning + '1F' },
            ]}
          >
            <Ionicons
              name={order.status === 'paid' ? 'checkmark' : 'time'}
              size={14}
              color={order.status === 'paid' ? colors.success : colors.warning}
            />
            <Text
              style={{
                color: order.status === 'paid' ? colors.success : colors.warning,
                fontSize: typography.sizes.caption,
                fontWeight: '700',
              }}
            >
              {order.status === 'paid' ? 'Pagada' : 'Pendiente'}
            </Text>
          </View>
        </View>

        {hasCustomer ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: 16 }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              CLIENTE
            </Text>
            {order.customer.customerName ? (
              <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '600' }}>
                {order.customer.customerName}
              </Text>
            ) : null}
            {order.customer.phone ? (
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>{order.customer.phone}</Text>
            ) : null}
            {order.customer.address ? (
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>{order.customer.address}</Text>
            ) : null}
            {order.customer.description ? (
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
                {order.customer.description}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          PRODUCTOS
        </Text>
        {order.items.map((item) => (
          <View key={item.product.id} style={[styles.itemRow, { backgroundColor: colors.surface, borderRadius: 14 }]}>
            <ProductImage product={item.product} size={38} />
            <View style={styles.itemInfo}>
              <Text
                numberOfLines={1}
                style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }}
              >
                {item.product.name}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
                {item.quantity} × {formatMoney(item.product.priceCents)}
              </Text>
            </View>
            <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }}>
              {formatMoney(item.product.priceCents * item.quantity)}
            </Text>
          </View>
        ))}

          <View style={[styles.totalCard, { backgroundColor: colors.surface, borderRadius: 16 }]}>
            <View style={styles.totalRow}>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>Total</Text>
              <MoneyDisplay cents={order.subtotalCents} size="large" />
            </View>
            {order.status === 'paid' ? (
              <>
                <View style={[styles.paidRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                  <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>Método</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '600' }}>
                    {order.paymentMethod === 'cash' ? '💵 Efectivo' : '🏦 Transferencia'}
                  </Text>
                </View>
                {order.receivedCents !== undefined ? (
                  <View style={styles.paidRow}>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>Efectivo recibido</Text>
                    <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body }}>
                      {formatMoney(order.receivedCents)}
                    </Text>
                  </View>
                ) : null}
                {order.changeCents !== undefined && order.changeCents > 0 ? (
                  <View style={styles.paidRow}>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>Cambio</Text>
                    <Text style={{ color: colors.primary, fontSize: typography.sizes.body, fontWeight: '600' }}>
                      {formatMoney(order.changeCents)}
                    </Text>
                  </View>
                ) : null}
                {order.paidAt ? (
                  <View style={styles.paidRow}>
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>Pagada el</Text>
                    <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body }}>
                      {formatDate(order.paidAt)} · {formatTime(order.paidAt)}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>

        <View style={styles.actions}>
          <PrimaryButton
            label={order.status === 'paid' ? 'Reimprimir ticket' : 'Ver ticket (pago pendiente)'}
            variant="outline"
            onPress={() => setTicketVisible(true)}
          />
          <View style={styles.actionsGap} />
          <PrimaryButton label="Cobrar orden" onPress={() => navigation.replace('PaymentMethod', { orderId: order.id })} />
          <View style={styles.actionsGap} />
          <PrimaryButton label="Editar carrito" variant="outline" onPress={handleEdit} />
          <View style={styles.actionsGap} />
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [styles.deleteButton, { borderColor: colors.danger + '55', opacity: pressed ? 0.75 : 1 }]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={[styles.deleteLabel, { color: colors.danger }]}>Eliminar orden</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={ticketVisible} transparent animationType="slide" onRequestClose={() => setTicketVisible(false)}>
        <View style={styles.ticketOverlay}>
          <View style={[styles.ticketCard, { backgroundColor: colors.surface, borderRadius: 16 }]}>
            <View style={styles.ticketHeader}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: typography.sizes.h2,
                  fontWeight: typography.weights.bold,
                }}
              >
                Ticket #{order.number}
              </Text>
              <Pressable onPress={() => setTicketVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView>
              <Text
                selectable
                style={{
                  color: colors.textPrimary,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 19,
                }}
              >
                {renderTicketText(buildTicket(order, businessName))}
              </Text>
            </ScrollView>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: typography.sizes.caption,
                textAlign: 'center',
                marginTop: 12,
              }}
            >
              Formato de impresión listo. Conecta la impresora para imprimir.
            </Text>
            <View style={styles.ticketClose}>
              <PrimaryButton label="Cerrar" onPress={() => setTicketVisible(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
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
    gap: 16,
    padding: 32,
  },
  backWrap: {
    alignSelf: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    letterSpacing: -0.5,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  card: {
    padding: 16,
    gap: 4,
    marginBottom: 16,
  },
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  totalCard: {
    padding: 18,
    marginTop: 8,
  },
  paidRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  actions: {
    marginTop: 24,
  },
  actionsGap: {
    marginTop: 12,
  },
  deleteButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  deleteLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '700',
    fontSize: 14,
  },
  ticketOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  ticketCard: {
    maxHeight: '80%',
    padding: 20,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  ticketClose: {
    marginTop: 14,
  },
});