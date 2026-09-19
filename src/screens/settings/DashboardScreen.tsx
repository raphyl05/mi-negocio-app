import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import MoneyDisplay from '../../components/MoneyDisplay';
import Screen from '../../components/Screen';
import type { Order } from '../../models/order';
import { orderRepository } from '../../repositories/orderRepository';
import { useTheme } from '../../theme';
import { formatMoney } from '../../utils/money';

type DayPoint = {
  label: string;
  fullLabel: string;
  totalCents: number;
};

function lastNDays(n: number): DayPoint[] {
  const points: DayPoint[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const dd = date.getDate().toString().padStart(2, '0');
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    points.push({
      label: dd,
      fullLabel: `${dd}/${mm}`,
      totalCents: 0,
    });
  }
  return points;
}

export default function DashboardScreen() {
  const { colors, spacing, typography } = useTheme();
  const [paid, setPaid] = useState<Order[]>([]);

  const load = useCallback(async () => {
    setPaid(await orderRepository.listPaid());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const { days, maxCents, total7d } = useMemo(() => {
    const points = lastNDays(7);
    const dayKey = (iso: string) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };
    const map = new Map<string, number>();
    for (const order of paid) {
      if (order.status !== 'paid') continue;
      const key = dayKey(order.paidAt ?? order.createdAt);
      map.set(key, (map.get(key) ?? 0) + order.subtotalCents);
    }
    const today = new Date();
    const indexed = points.map((point) => {
      const key = `${today.getFullYear()}-${today.getMonth()}-${parseInt(point.label, 10)}`;
      return { ...point, totalCents: map.get(key) ?? 0 };
    });
    const maxCents = Math.max(1, ...indexed.map((point) => point.totalCents));
    const total7d = indexed.reduce((sum, point) => sum + point.totalCents, 0);
    return { days: indexed, maxCents, total7d };
  }, [paid]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          Panel de ventas
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
          Últimos 7 días (solo ventas cobradas).
        </Text>

        <Card style={styles.card}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
            TOTAL ULTIMOS 7 DÍAS
          </Text>
          <MoneyDisplay cents={total7d} size="large" />
          <Text style={[styles.subLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
            {paid.length} ventas cobradas en el historial
          </Text>

          <View style={styles.chart}>
            {days.map((point, index) => {
              const height = Math.max(4, Math.round((point.totalCents / maxCents) * 120));
              const isToday = index === days.length - 1;
              return (
                <View key={point.fullLabel} style={styles.barColumn}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[styles.barValue, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}
                  >
                    {formatMoney(point.totalCents)}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height,
                          backgroundColor: isToday ? colors.primary : colors.primaryLight,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                    {point.fullLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        {days.map((point) => (
          <View key={point.fullLabel} style={styles.dayRow}>
            <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '600' }}>{point.fullLabel}</Text>
            <MoneyDisplay cents={point.totalCents} size="small" />
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  title: {
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
  },
  card: {
    gap: 10,
    marginBottom: 16,
  },
  sectionLabel: {
    letterSpacing: 1,
    fontWeight: '700',
  },
  subLabel: {
    marginTop: -4,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
    minHeight: 170,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barValue: {
    marginBottom: 4,
    maxWidth: '100%',
    textAlign: 'center',
  },
  barTrack: {
    height: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  bar: {
    width: '60%',
    borderRadius: 6,
  },
  barLabel: {
    marginTop: 6,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
});