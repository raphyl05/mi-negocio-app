import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Card from '../../components/Card';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import { usePrinter } from '../../hooks/usePrinter';
import type { RootStackParamList } from '../../navigation/types';
import { printerService } from '../../services/printerService';
import { BLUETOOTH_PENDING_REASON } from '../../services/printer/transports/bluetoothTransport';
import type { DiscoveredPrinter, PrinterTransportInfo } from '../../services/printer/types';
import { useTheme } from '../../theme';

const TYPE_LABELS: Record<string, string> = {
  bluetooth: 'Bluetooth (térmica)',
  system: 'Sistema / integrada',
  demo: 'Modo prueba',
};

export default function PrinterConfigScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { status } = usePrinter();

  const [searching, setSearching] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [devices, setDevices] = useState<DiscoveredPrinter[]>([]);
  const [infos, setInfos] = useState<PrinterTransportInfo[]>([]);

  useEffect(() => {
    setInfos(printerService.transportInfo());
    printerService.discover().then(setDevices).catch(() => undefined);
  }, []);

  const handleSwitch = async (enabled: boolean) => {
    const result = await printerService.setEnabled(enabled);
    if (!result.ok) Alert.alert('Impresora', result.message);
  };

  const handleSearch = async () => {
    setSearching(true);
    try {
      const found = await printerService.discover();
      setDevices(found);
      if (found.length === 0) Alert.alert('Buscar impresoras', 'No se encontraron impresoras activas.');
    } finally {
      setSearching(false);
    }
  };

  const handleConnect = async (printer: DiscoveredPrinter) => {
    setConnecting(true);
    try {
      const result = await printerService.connect(printer);
      Alert.alert(result.ok ? 'Conectada' : 'Error', result.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleTest = async () => {
    setPrinting(true);
    try {
      const result = await printerService.printTest();
      Alert.alert(result.ok ? 'Impresión' : 'Error', result.message);
    } finally {
      setPrinting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Desconectar impresora', 'Se desactivará la impresión. Puedes volver a conectarla cuando quieras.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desconectar', style: 'destructive', onPress: () => printerService.disconnect() },
    ]);
  };

  const stateMeta = (() => {
    if (!status.enabled) return { label: 'Apagada', color: colors.textSecondary, icon: 'power-outline' as const };
    if (status.state === 'connected') return { label: 'Activa', color: colors.success, icon: 'checkmark-circle' as const };
    if (status.state === 'connecting') return { label: 'Conectando…', color: colors.warning, icon: 'sync' as const };
    return { label: 'Sin conexión', color: colors.danger, icon: 'alert-circle' as const };
  })();

  const bluetoothInfo = infos.find((info) => info.kind === 'bluetooth');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          Impresora
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
          Conecta una impresora para imprimir el ticket de cada venta. Una vez configurada, la app se reconecta sola
          cuando la impresora se enciende.
        </Text>

        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name={stateMeta.icon} size={22} color={stateMeta.color} />
              </View>
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }}>
                  Impresión {stateMeta.label}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, marginTop: 2 }}>
                  {status.label}
                </Text>
              </View>
            </View>
            <Switch
              value={status.enabled}
              onValueChange={handleSwitch}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={status.enabled ? colors.primary : colors.surfaceMuted}
            />
          </View>

          {status.enabled && status.name ? (
            <View style={styles.connectedBox}>
              <View style={[styles.connectedRow, { backgroundColor: colors.surfaceMuted, borderRadius: 12 }]}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="print-outline" size={20} color={colors.primary} />
                    <View>
                      <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '600' }}>
                        {status.name}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, marginTop: 2 }}>
                        {status.type ? TYPE_LABELS[status.type] ?? status.type : ''}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={handleDisconnect} hitSlop={8}>
                    <Text style={{ color: colors.danger, fontSize: typography.sizes.caption, fontWeight: '700' }}>
                      Desconectar
                    </Text>
                  </Pressable>
                </View>
              </View>
              <PrimaryButton
                label="Imprimir ticket de prueba"
                variant={status.ready ? 'primary' : 'outline'}
                onPress={handleTest}
                loading={printing}
                disabled={!status.ready}
              />
            </View>
          ) : null}
        </Card>

        <View style={styles.gap} />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          BUSCAR IMPRESORA
        </Text>
        <Card style={styles.card}>
          <PrimaryButton label="Buscar impresoras activas" variant="outline" onPress={handleSearch} loading={searching} />

          {devices.length > 0
            ? devices.map((printer) => (
                <View key={printer.id}>
                  <View style={styles.separator} />
                  <Pressable
                    onPress={() => handleConnect(printer)}
                    disabled={connecting}
                    style={({ pressed }) => [styles.deviceRow, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name="print-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '600' }}>
                        {printer.name}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, marginTop: 2 }}>
                        {TYPE_LABELS[printer.type] ?? printer.type}
                        {printer.address ? ` · ${printer.address}` : ''}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: status.name === printer.name ? colors.success + '1A' : colors.surfaceMuted,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: status.name === printer.name ? colors.success : colors.textSecondary,
                          fontSize: typography.sizes.caption,
                          fontWeight: '700',
                        }}
                      >
                        {status.name === printer.name ? 'Conectada' : 'Conectar'}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ))
            : null}

          <View style={styles.separator} />
          <View style={styles.noteRow}>
            <Ionicons name="phone-portrait-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.note, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              La impresora del sistema detecta impresoras integradas y las listadas por el sistema (Android/iPhone). En
              la terminal POS, elige la impresora integrada en el diálogo del sistema.
            </Text>
          </View>
        </Card>

        <View style={styles.gap} />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          IMPRESORA BLUETOOTH
        </Text>
        <Card style={styles.card}>
          <View style={styles.noteRow}>
            <Ionicons name="bluetooth-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.note, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
              Conecta la impresora térmica BLE (58 mm) desde aquí. Debe ser una térmica con Bluetooth BLE y la app debe
              estar compilada con React Native (EAS/development build), no desde Expo Go.
            </Text>
          </View>
          {bluetoothInfo?.reason ? (
            <Text style={[styles.note, { color: colors.warning, fontSize: typography.sizes.caption, lineHeight: 18 }]}>
              {bluetoothInfo.reason}
            </Text>
          ) : null}
        </Card>

        <View style={styles.actions}>
          <PrimaryButton label="Listo" variant="outline" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </Screen>
  );
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
    lineHeight: 22,
  },
  gap: {
    height: 20,
  },
  card: {
    gap: 12,
    marginBottom: 16,
  },
  sectionLabel: {
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowText: {
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedBox: {
    gap: 10,
  },
  connectedRow: {
    padding: 12,
  },
  separator: {
    height: 1,
    backgroundColor: 'transparent',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  note: {
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
});