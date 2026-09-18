import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MoneyDisplay from '../../components/MoneyDisplay';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import TextField from '../../components/TextField';
import { useCart } from '../../contexts/CartContext';
import type { PaymentMethod } from '../../models/order';
import type { RootStackParamList } from '../../navigation/types';
import { orderRepository } from '../../repositories/orderRepository';
import { useTheme } from '../../theme';
import { calcChange, formatMoney, parseMoney } from '../../utils/money';
import { buildOrder } from '../../utils/order';

const QUICK_AMOUNTS = [100, 200, 500, 1000];

export default function PaymentMethodScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, subtotalCents, customer, clear } = useCart();

  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [receivedText, setReceivedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const receivedCents = parseMoney(receivedText);
  const showChange = receivedCents !== null && receivedCents >= subtotalCents;
  const changeCents = showChange ? calcChange(subtotalCents, receivedCents) : null;

  const handleConfirm = async () => {
    if (method === 'cash') {
      const cents = parseMoney(receivedText);
      if (cents === null) {
        setError('Ingresa el efectivo recibido, por ejemplo 500 o 500.50');
        return;
      }
      if (cents < subtotalCents) {
        setError(`El efectivo recibido es menor al total (${formatMoney(subtotalCents)}).`);
        return;
      }
      await confirmCash(cents);
    } else {
      await confirmTransfer();
    }
  };

  const confirmCash = async (received: number) => {
    setSaving(true);
    try {
      const order = buildOrder({ items, customer, status: 'paid', paymentMethod: 'cash', receivedCents: received });
      const saved = await orderRepository.save(order);
      clear();
      navigation.replace('OrderComplete', { orderId: saved.id });
    } finally {
      setSaving(false);
    }
  };

  const confirmTransfer = async () => {
    setSaving(true);
    try {
      const order = buildOrder({ items, customer, status: 'paid', paymentMethod: 'transfer' });
      const saved = await orderRepository.save(order);
      clear();
      navigation.replace('OrderComplete', { orderId: saved.id });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          ¿Cómo cobra?
        </Text>

        <View style={[styles.total, { backgroundColor: colors.surface, borderRadius: 16 }]}>
          <Text style={[styles.totalLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
            TOTAL A COBRAR
          </Text>
          <MoneyDisplay cents={subtotalCents} size="large" />
        </View>

        <MethodSelector method={method} onSelect={setMethod} />

        {method === 'cash' ? (
          <View style={styles.cashPanel}>
            <TextField
              label="Efectivo recibido (RD$)"
              value={receivedText}
              onChangeText={(text) => {
                setReceivedText(text);
                setError(null);
              }}
              error={error ?? undefined}
              keyboardType="decimal-pad"
              placeholder="Ej. 500 o 500.50"
            />

            <View style={styles.quickRow}>
              <QuickChip label="Exacto" onPress={() => setReceivedText(String(subtotalCents / 100))} />
              {QUICK_AMOUNTS.map((amount) => (
                <QuickChip key={amount} label={String(amount)} onPress={() => setReceivedText(String(amount))} />
              ))}
            </View>

            {showChange && changeCents !== null ? (
              <View style={styles.changeRow}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>Cambio a devolver</Text>
                <Text style={{ color: colors.primary, fontSize: typography.sizes.h2, fontWeight: '700' }}>
                  {formatMoney(changeCents)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={[styles.transferNote, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
            El cliente pagará por transferencia. La venta quedará registrada cuando confirmes.
          </Text>
        )}

        <View style={styles.action}>
          <PrimaryButton label="Confirmar pago" onPress={handleConfirm} loading={saving} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function MethodSelector({ method, onSelect }: { method: PaymentMethod; onSelect: (m: PaymentMethod) => void }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.methodRow}>
      <MethodOption
        label="💵 Efectivo"
        active={method === 'cash'}
        onPress={() => onSelect('cash')}
      />
      <MethodOption
        label="🏦 Transferencia"
        active={method === 'transfer'}
        onPress={() => onSelect('transfer')}
      />
    </View>
  );
}

function MethodOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.methodOption,
        {
          backgroundColor: active ? colors.primary : colors.surface,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.methodText, { color: active ? colors.textOnPrimary : colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function QuickChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickChip,
        { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{label}</Text>
    </Pressable>
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
  total: {
    padding: 20,
    marginBottom: 16,
  },
  totalLabel: {
    letterSpacing: 1,
    marginBottom: 6,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  methodOption: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodText: {
    fontWeight: '600',
  },
  cashPanel: {
    gap: 12,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  transferNote: {
    lineHeight: 22,
    marginBottom: 4,
  },
  action: {
    marginTop: 24,
  },
});