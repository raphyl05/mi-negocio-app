import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { parseDateInput } from '../utils/datetime';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

type CalendarModalProps = {
  visible: boolean;
  mode?: 'range' | 'single';
  title?: string;
  initialFrom?: string;
  initialTo?: string;
  singleValue?: string;
  onApply: (from: Date, to: Date | null) => void;
  onClear: () => void;
  onClose: () => void;
};

function toInput(date: Date): string {
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBetween(day: Date, start: Date, end: Date): boolean {
  return day >= start && day <= end;
}

function buildCells(view: Date): (Date | null)[] {
  const offset = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;
  const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let day = 1; day <= count; day += 1) {
    cells.push(new Date(view.getFullYear(), view.getMonth(), day));
  }
  while (cells.length < 42) cells.push(null);
  return cells;
}

export default function CalendarModal({
  visible,
  mode = 'range',
  title,
  initialFrom,
  initialTo,
  singleValue,
  onApply,
  onClear,
  onClose,
}: CalendarModalProps) {
  const { colors, spacing, typography } = useTheme();
  const [view, setView] = useState(() => {
    const base =
      parseDateInput(mode === 'single' ? (singleValue ?? '') : (initialFrom ?? '')) ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [single, setSingle] = useState<Date | null>(() =>
    mode === 'single' ? parseDateInput(singleValue ?? '') : null,
  );
  const [start, setStart] = useState<Date | null>(() => parseDateInput(initialFrom ?? ''));
  const [end, setEnd] = useState<Date | null>(() => parseDateInput(initialTo ?? ''));

  useEffect(() => {
    if (!visible) return;
    if (mode === 'single') {
      setSingle(parseDateInput(singleValue ?? ''));
      const base = parseDateInput(singleValue ?? '') ?? new Date();
      setView(new Date(base.getFullYear(), base.getMonth(), 1));
      return;
    }
    const from = parseDateInput(initialFrom ?? '');
    const to = parseDateInput(initialTo ?? '');
    setStart(from);
    setEnd(to);
    const base = from ?? new Date();
    setView(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [visible, mode, singleValue, initialFrom, initialTo]);

  const cells = useMemo(() => buildCells(view), [view]);

  const goMonth = (delta: number) => {
    setView((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const onPressDay = (day: Date) => {
    if (mode === 'single') {
      setSingle(day);
      return;
    }
    if (!start || (start && end)) {
      setStart(day);
      setEnd(null);
    } else if (day < start) {
      setStart(day);
    } else {
      setEnd(day);
    }
  };

  const canApply = mode === 'single' ? single !== null : start !== null && end !== null;

  const handleApply = () => {
    if (mode === 'single') {
      if (!single) return;
      onApply(single, null);
    } else {
      if (!start || !end) return;
      onApply(start, end);
    }
    onClose();
  };

  const handleClear = () => {
    if (mode === 'single') {
      setSingle(null);
    } else {
      setStart(null);
      setEnd(null);
    }
    onClear();
    onClose();
  };

  const hint =
    mode === 'single'
      ? single
        ? `Fecha: ${toInput(single)}`
        : 'Elige un día para esa fecha.'
      : !start
        ? 'Toca el día inicial y después el día final.'
        : !end
          ? `Desde el ${toInput(start)} · toca el día final`
          : `Rango: ${toInput(start)} – ${toInput(end)}`;

  const today = new Date();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, boxShadow: undefined, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          {title ? (
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: typography.sizes.body,
                fontWeight: typography.weights.extrabold,
                marginBottom: 4,
              }}
            >
              {title}
            </Text>
          ) : null}
          <View style={styles.header}>
            <Pressable onPress={() => goMonth(-1)} hitSlop={8} style={styles.navButton}>
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: typography.sizes.body,
                fontWeight: typography.weights.extrabold,
              }}
            >
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </Text>
            <Pressable onPress={() => goMonth(1)} hitSlop={8} style={styles.navButton}>
              <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <View key={w} style={styles.cell}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, fontWeight: '700' }}>
                  {w}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, index) =>
              day === null ? (
                <View key={`empty-${index}`} style={styles.cell} />
              ) : (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => onPressDay(day)}
                  style={styles.cell}
                >
                  {({ pressed }) => {
                    const isSel = mode === 'single' && single !== null && sameDay(day, single);
                    const isStart = mode !== 'single' && start !== null && sameDay(day, start);
                    const isEnd = mode !== 'single' && end !== null && sameDay(day, end);
                    const inRange = mode !== 'single' && start !== null && end !== null && isBetween(day, start, end);
                    const isToday = sameDay(day, today);
                    const background = isSel || isStart || isEnd ? colors.primary : inRange ? colors.primaryLight : 'transparent';
                    const textColor = isSel || isStart || isEnd ? colors.textOnPrimary : colors.textPrimary;
                    return (
                      <View
                        style={[
                          styles.day,
                          {
                            backgroundColor: background,
                            borderColor: isToday ? colors.primary : 'transparent',
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text style={{ color: textColor, fontSize: typography.sizes.body, fontWeight: isSel || isStart || isEnd ? '800' : '500' }}>
                          {day.getDate()}
                        </Text>
                      </View>
                    );
                  }}
                </Pressable>
              ),
            )}
          </View>

          <Text style={[styles.hint, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
            {hint}
          </Text>

          <View style={styles.actions}>
            {(mode === 'single' ? single !== null : start !== null || end !== null) ? (
              <Pressable onPress={handleClear} style={[styles.textAction, { opacity: 1 }]}>
                <Text style={{ color: colors.danger, fontSize: typography.sizes.body, fontWeight: '700' }}>Limpiar</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <View style={styles.actionsRight}>
              <Pressable onPress={onClose} style={styles.textAction}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body, fontWeight: '600' }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleApply}
                disabled={!canApply}
                style={({ pressed }) => [
                  styles.applyButton,
                  {
                    backgroundColor: canApply ? colors.primary : colors.surfaceMuted,
                    opacity: pressed && canApply ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={{ color: canApply ? colors.textOnPrimary : colors.textSecondary, fontSize: typography.sizes.body, fontWeight: '700' }}>
                  Aplicar
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  applyButton: {
    minWidth: 96,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});