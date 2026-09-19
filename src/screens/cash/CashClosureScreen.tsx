import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import MoneyDisplay from '../../components/MoneyDisplay';
import PrimaryButton from '../../components/PrimaryButton';
import ReceiptPreviewModal from '../../components/ReceiptPreviewModal';
import Screen from '../../components/Screen';
import TextField from '../../components/TextField';
import type { Business } from '../../models/business';
import type { CashRegister } from '../../models/cashRegister';
import type { Order } from '../../models/order';
import type { RootStackParamList } from '../../navigation/types';
import { orderRepository } from '../../repositories/orderRepository';
import { closeRegister, getOpenRegister } from '../../services/cashRegisterService';
import { getBusiness } from '../../services/setupService';
import { useTheme } from '../../theme';
import type { Colors } from '../../theme/colors';
import { calcCashClosure, isOrderInRegister, renderClosureReceiptText } from '../../utils/cashClosure';
import { parseMoney, formatMoneyBlur, unformatMoneyFocus } from '../../utils/money';

export default function CashClosureScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [register, setRegister] = useState<CashRegister | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [countedText, setCountedText] = useState('');
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [closing, setClosing] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [receiptText, setReceiptText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const reg = await getOpenRegister();
      if (!active || !reg) return;
      const paid = await orderRepository.listPaid();
      const sessionOrders = paid.filter((order) => isOrderInRegister(order, reg.openedAt));
      const biz = await getBusiness();
      if (!active) return;
      setRegister(reg);
      setOrders(sessionOrders);
      setBusiness(biz);
      if (countedText === '') {
        const expected = calcCashClosure({
          openingAmountCents: reg.openingAmountCents,
          countedCashCents: 0,
          orders: sessionOrders,
        }).expectedCashCents;
        setCountedText((expected / 100).toFixed(2));
      }
      setLoadedOnce(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!loadedOnce) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const counted = parseMoney(countedText);
  const summary = register
    ? calcCashClosure({
        openingAmountCents: register.openingAmountCents,
        countedCashCents: counted ?? 0,
        orders,
      })
    : null;

  if (!register || !summary) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body, textAlign: 'center' }}>
            No hay caja abierta.
          </Text>
        </View>
      </Screen>
    );
  }

  const difference = counted !== null ? summary.differenceCents : null;
  const countingError = attempted && counted === null ? 'Ingresa el efectivo contado, por ejemplo 700 o 700.50' : null;

  const doClose = async (cents: number) => {
    setClosing(true);
    try {
      const live = calcCashClosure({
        openingAmountCents: register.openingAmountCents,
        countedCashCents: cents,
        orders,
      });
      const record = await closeRegister({
        openingAmountCents: live.openingAmountCents,
        expectedCashCents: live.expectedCashCents,
        countedCashCents: cents,
        differenceCents: live.differenceCents,
      });
      setReceiptText(
        renderClosureReceiptText(business ?? { name: 'Mi Negocio', createdAt: record.closedAt }, live, record.closedAt),
      );
    } finally {
      setClosing(false);
    }
  };

  const handleClose = () => {
    const cents = parseMoney(countedText);
    if (cents === null || cents < 0) {
      setAttempted(true);
      return;
    }
    const falta = cents > summary.expectedCashCents;
    const isExact = cents === summary.expectedCashCents;
    const message = isExact
      ? 'La caja cuadra exactamente.'
      : `Hay una diferencia de ${money(Math.abs(cents - summary.expectedCashCents))} (${falta ? 'falta' : 'sobra'}).`;

    if (isExact) {
      Alert.alert('Cerrar caja', `Al cerrar terminarás el turno.\n\n${message}`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar caja',
          style: 'destructive',
          onPress: () => doClose(cents),
        },
      ]);
      return;
    }

    Alert.alert(
      'Confirmar cierre',
      `${message}\n\n¿Seguro que deseas cerrar la caja de todas formas con esta diferencia?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar de todas formas',
          style: 'destructive',
          onPress: () => doClose(cents),
        },
      ],
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          Resumen del día
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          Caja abierta con {money(summary.openingAmountCents)} · {summary.orderCount}{' '}
          {summary.orderCount === 1 ? 'venta' : 'ventas'} pagadas en el turno.
        </Text>

        <Card style={styles.card}>
          <Text style={styles.sectionLabel}>VENTAS DEL TURNO</Text>
          <SummaryRow label="Total vendido" cents={summary.salesCents} />
          <SummaryRow label="En efectivo" cents={summary.cashSalesCents} />
          <SummaryRow label="Por transferencia" cents={summary.transferSalesCents} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionLabel}>EFECTIVO EN CAJA (ESPERADO)</Text>
          <MoneyDisplay cents={summary.expectedCashCents} size="large" />
          <Text style={[styles.hint, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
            {money(summary.openingAmountCents)} de apertura + {money(summary.cashSalesCents)} de ventas en efectivo.
          </Text>
        </Card>

        <Card style={styles.card}>
          <TextField
            label="Efectivo contado (RD$)"
            value={countedText}
            onChangeText={setCountedText}
            error={countingError ?? undefined}
            keyboardType="decimal-pad"
            placeholder="Ej. 700 o 700.50"
            formatOnFocus={unformatMoneyFocus}
            formatOnBlur={formatMoneyBlur}
          />

          {difference !== null ? (
            <View style={styles.diffRow}>
              <View style={[styles.diffBadge, { backgroundColor: diffColor(colors, difference) }]}>
                <Ionicons name={difference === 0 ? 'checkmark-circle' : difference > 0 ? 'alert-circle' : 'warning'} size={18} color={diffTextColor(colors, difference)} />
              </View>
              <View style={styles.diffText}>
                <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }}>
                  {difference === 0 ? 'La caja cuadra' : difference > 0 ? 'Falta dinero' : 'Sobra dinero'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
                  {difference === 0
                    ? 'El conteo coincide con lo esperado.'
                    : `Diferencia de ${money(Math.abs(difference))} ${difference > 0 ? '(falta)' : '(sobra)'}.`}
                </Text>
              </View>
              <MoneyDisplay cents={Math.abs(difference)} size="small" color={diffTextColor(colors, difference)} />
            </View>
          ) : null}
        </Card>

        <View style={styles.actions}>
          <PrimaryButton label="Cerrar caja" onPress={handleClose} loading={closing} />
          <PrimaryButton label="Volver" variant="outline" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>

      <ReceiptPreviewModal
        visible={receiptText !== null}
        title="Recibo de cierre"
        text={receiptText ?? ''}
        logoBase64={business?.logoBase64}
        note="Formato de impresión listo. Conecta la impresora para imprimir el recibo."
        onClose={() => {
          setReceiptText(null);
          navigation.goBack();
        }}
      />
    </Screen>
  );

  function SummaryRow({ label, cents }: { label: string; cents: number }) {
    return (
      <View style={styles.summaryRow}>
        <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>{label}</Text>
        <MoneyDisplay cents={cents} size="small" />
      </View>
    );
  }
}

function diffColor(colors: Colors, difference: number): string {
  if (difference === 0) return colors.success + '1F';
  if (difference > 0) return colors.danger + '1A';
  return colors.warning + '33';
}

function diffTextColor(colors: Colors, difference: number): string {
  if (difference === 0) return colors.success;
  if (difference > 0) return colors.danger;
  return colors.warning;
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(cents) / 100);
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
  },
  card: {
    gap: 12,
    marginBottom: 16,
  },
  sectionLabel: {
    letterSpacing: 1,
    fontWeight: '700',
  },
  hint: {
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  diffBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diffText: {
    flex: 1,
    gap: 2,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
});