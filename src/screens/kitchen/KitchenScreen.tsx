import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen';
import { useTheme } from '../../theme';
import { orderRepository } from '../../repositories/orderRepository';
import type { Order } from '../../models/order';
import { apiCreateKitchenTicket, apiCancelKitchenTicket, apiUpdateKitchenStatus } from '../../services/kitchenApi';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useNotifications } from '../../contexts/NotificationContext';
import PrimaryButton from '../../components/PrimaryButton';
import { formatMoney } from '../../utils/money';

const PREP_STATUS_LABEL: Record<string, string> = {
  new: 'Nueva',
  sent: 'Enviada',
  preparing: 'Preparando',
  ready: 'Lista',
  served: 'Entregada',
};

const PREP_STATUS_COLORS: Record<string, string> = {
  new: '#94a3b8',
  sent: '#3b82f6',
  preparing: '#f59e0b',
  ready: '#22c55e',
  served: '#a855f7',
};

const STATUS_ORDER = ['sent', 'preparing', 'ready', 'served'];
const POLL_INTERVAL_MS = 10000;

export default function KitchenScreen() {
  const { colors, spacing, typography } = useTheme();
  const { hasCapability, session } = useAuth();
  const { clear } = useCart();
  const { notify } = useNotifications();
  const businessId = session?.businesses[0]?.id ?? '';
  const kitchenEnabled = hasCapability(businessId, 'kitchen');

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await orderRepository.listAll();
      const kitchenOrders = all.filter((o) => o.kitchenTicketId || o.status === 'pending');
      setOrders(kitchenOrders);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!kitchenEnabled) return;
    load();
    pollRef.current = setInterval(() => {
      load().catch(() => { /* silenciar error de polling */ });
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load, kitchenEnabled]);

  const handleCreateTicket = async (orderId: string) => {
    setProcessing(orderId);
    try {
      const res = await apiCreateKitchenTicket(orderId);
      if (res.ok) {
        notify('Comanda enviada a cocina', 'success');
        await load();
      } else {
        notify(res.error?.message ?? 'Error al enviar a cocina', 'error');
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleUpdateStatus = async (orderId: string, prepStatus: string) => {
    setProcessing(orderId);
    try {
      const res = await apiUpdateKitchenStatus(orderId, prepStatus);
      if (res.ok) {
        notify(`Estado actualizado a ${PREP_STATUS_LABEL[prepStatus]}`, 'success');
        await load();
      } else {
        notify(res.error?.message ?? 'Error al actualizar estado', 'error');
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleCancel = async (orderId: string) => {
    setProcessing(orderId);
    try {
      const res = await apiCancelKitchenTicket(orderId);
      if (res.ok) {
        notify('Comanda cancelada', 'warning');
        await load();
      } else {
        notify(res.error?.message ?? 'Error al cancelar', 'error');
      }
    } finally {
      setProcessing(null);
    }
  };

  const nextStatus = (current?: string): string | null => {
    const idx = STATUS_ORDER.indexOf(current ?? '');
    return idx >= 0 && idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
  };

  if (!kitchenEnabled) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
            Cocina no está activada para este negocio.
          </Text>
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold }]}>
          Cocina
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
          {orders.filter((o) => o.kitchenTicketId).length} comandas activas
        </Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
            No hay comandas en cocina.
          </Text>
        </View>
      ) : null}

      {orders.map((order) => (
        <View key={order.id} style={[styles.card, { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.orderNumber, { color: colors.textPrimary, fontSize: typography.sizes.h2, fontWeight: '700' }]}>
              #{order.number}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: (PREP_STATUS_COLORS[order.prepStatus ?? 'new'] ?? '#94a3b8') + '22' }]}>
              <Text style={[styles.statusText, { color: PREP_STATUS_COLORS[order.prepStatus ?? 'new'] ?? '#94a3b8' }]}>
                {PREP_STATUS_LABEL[order.prepStatus ?? 'new']}
              </Text>
            </View>
          </View>

          <View style={styles.cardInfo}>
            {order.waiterName ? (
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
                Mesero: {order.waiterName}
              </Text>
            ) : null}
            {order.tableName ? (
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
                Mesa: {order.tableName}
              </Text>
            ) : null}
            {order.customer.customerName ? (
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
                Cliente: {order.customer.customerName}
              </Text>
            ) : null}
          </View>

          <View style={styles.cardTotal}>
            <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }}>
              {formatMoney(order.subtotalCents)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
              {order.items?.length ?? 0} items
            </Text>
          </View>

          <View style={styles.actions}>
            {!order.kitchenTicketId && order.status === 'pending' ? (
              <PrimaryButton
                label="Enviar a cocina"
                onPress={() => handleCreateTicket(order.id)}
                loading={processing === order.id}
              />
            ) : null}
            {order.kitchenTicketId && order.prepStatus !== 'served' ? (
              <>
                {(() => {
                  const ns = nextStatus(order.prepStatus);
                  return ns ? (
                    <PrimaryButton
                      label={PREP_STATUS_LABEL[ns]}
                      onPress={() => handleUpdateStatus(order.id, ns)}
                      loading={processing === order.id}
                    />
                  ) : null;
                })()}
                <View style={styles.actionGap} />
                <PrimaryButton
                  label="Cancelar comanda"
                  variant="outline"
                  onPress={() => handleCancel(order.id)}
                  loading={processing === order.id}
                />
              </>
            ) : null}
          </View>
        </View>
      ))}
    </Screen>
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
  subtitle: {
    marginTop: 4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 20,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardInfo: {
    gap: 2,
    marginBottom: 8,
  },
  cardTotal: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actions: {
    gap: 8,
  },
  actionGap: {
    height: 8,
  },
});
