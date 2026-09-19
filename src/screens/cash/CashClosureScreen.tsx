import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Card from '../../components/Card';
import Column from '../../components/Column';
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
import {
  ALL_DENOMINATIONS,
  BILL_DENOMINATIONS,
  COIN_DENOMINATIONS,
  countTotalCents,
  hasAnyCount,
  sanitizeDenominationInput,
} from '../../utils/cashDenomination';
import type { DenominationCounts } from '../../utils/cashDenomination';
import { parseMoney, formatMoney, formatMoneyBlur } from '../../utils/money';
import { sanitizeMoneyInput } from '../../utils/inputFormat';

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
  const [useDenominations, setUseDenominations] = useState(false);
  const [denomCounts, setDenomCounts] = useState<DenominationCounts>(
    Object.fromEntries(ALL_DENOMINATIONS.map((denomination) => [String(denomination), ''])),
  );

  const setDenomCount = (denomination: number, text: string) => {
    setDenomCounts((current) => ({ ...current, [String(denomination)]: text }));
  };

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

  const manualCounted = parseMoney(countedText);
  const denomTotal = countTotalCents(denomCounts);
  const denomHasAny = hasAnyCount(denomCounts);
  const countingDone = useDenominations ? denomHasAny : manualCounted !== null;
  const countedCents = useDenominations ? denomTotal : (manualCounted ?? 0);
  const summary = register
    ? calcCashClosure({
        openingAmountCents: register.openingAmountCents,
        countedCashCents: countingDone ? countedCents : 0,
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

  const difference = countingDone && summary ? summary.differenceCents : null;
  const manualError =
    attempted && !useDenominations && manualCounted === null
      ? 'Ingresa el efectivo contado, por ejemplo 700 o 700.50'
      : null;
  const denominationError =
    attempted && useDenominations && !denomHasAny ? 'Ingresa al menos una denominación.' : null;

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
    const cents = useDenominations ? denomTotal : parseMoney(countedText);
    if (cents === null || cents < 0 || (useDenominations && !denomHasAny)) {
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
        <Column>
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
          <Text style={styles.sectionLabel}>EFECTIVO EN CAJA</Text>
          <MoneyDisplay cents={countingDone ? countedCents : 0} size="large" />
        </Card>

        <Card style={styles.card}>
          <View style={styles.denomToggle}>
            <View style={styles.denomToggleText}>
              <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }}>
                Contar por denominaciones
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
                Billetes y monedas (RD$)
              </Text>
            </View>
            <Switch
              value={useDenominations}
              onValueChange={setUseDenominations}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={useDenominations ? colors.primary : colors.surfaceMuted}
            />
          </View>

          {useDenominations ? (
            <DenominationCounter counts={denomCounts} onChange={setDenomCount} />
          ) : (
            <TextField
              label="Efectivo contado (RD$)"
              value={countedText}
              onChangeText={setCountedText}
              error={manualError ?? undefined}
              keyboardType="decimal-pad"
              placeholder="Ej. 700 o 700.50"
              formatOnBlur={formatMoneyBlur}
              sanitize={sanitizeMoneyInput}
              selectTextOnFocus
            />
          )}

          {denominationError ? (
            <Text style={[styles.denomError, { color: colors.danger, fontSize: typography.sizes.caption }]}>
              {denominationError}
            </Text>
          ) : null}

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
        </Column>
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

function DenominationCounter({
  counts,
  onChange,
}: {
  counts: DenominationCounts;
  onChange: (denomination: number, text: string) => void;
}) {
  const { colors, typography } = useTheme();

  const renderRow = (denomination: number) => (
    <View key={denomination} style={styles.denomRow}>
      <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body }}>
        {formatMoney(denomination * 100)}
      </Text>
      <TextInput
        value={counts[String(denomination)] ?? ''}
        onChangeText={(text) => onChange(denomination, sanitizeDenominationInput(text))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.denomInput,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.textPrimary },
        ]}
        textAlign="center"
      />
    </View>
  );

  return (
    <View style={styles.denomBlock}>
      <Text style={[styles.groupLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
        BILLETES
      </Text>
      {BILL_DENOMINATIONS.map(renderRow)}
      <Text style={[styles.groupLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
        MONEDAS
      </Text>
      {COIN_DENOMINATIONS.map(renderRow)}
      <View style={[styles.denomTotal, { borderTopColor: colors.border }]}>
        <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>Total contado</Text>
        <MoneyDisplay cents={countTotalCents(counts)} size="small" />
      </View>
    </View>
  );
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
  denomToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  denomToggleText: {
    flex: 1,
    gap: 2,
  },
  denomError: {
    marginLeft: 4,
  },
  denomBlock: {
    gap: 8,
  },
  groupLabel: {
    letterSpacing: 1,
    fontWeight: '700',
    marginTop: 4,
  },
  denomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  denomInput: {
    minWidth: 72,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 16,
    fontWeight: '700',
  },
  denomTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 6,
    paddingTop: 10,
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