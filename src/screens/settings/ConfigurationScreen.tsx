import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Card from '../../components/Card';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import { usePrinter } from '../../hooks/usePrinter';
import { useAuth } from '../../contexts/AuthContext';
import { apiGetCapabilities, apiUpdateCapabilities, type BusinessCapabilities } from '../../services/authApi';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const FEATURES = [
  { key: 'restaurant', icon: 'restaurant', title: 'Modo restaurante', desc: 'Comandas, mesas y cocina' },
  { key: 'waiters', icon: 'person', title: 'Meseros', desc: 'Asignar meseros a órdenes' },
  { key: 'tables', icon: 'list', title: 'Mesas', desc: 'Gestionar mesas y ocupación' },
  { key: 'kitchen', icon: 'walk', title: 'Cocina', desc: 'Comanda de cocina y estado' },
  { key: 'kitchenPrinting', icon: 'print', title: 'Impresión cocina', desc: 'Tickets de cocina automáticos' },
] as const;

export default function ConfigurationScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { statusLabel, available } = usePrinter();
  const { session, hasCapability, fetchCapabilities, setCapabilitiesCache } = useAuth();
  const businessId = session?.activeBusinessId ?? session?.businesses[0]?.id ?? '';

  const [localCaps, setLocalCaps] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) {
      setLocalCaps(null);
      return;
    }
    let cancelled = false;
    fetchCapabilities(businessId).then((caps) => {
      if (cancelled || !caps) return;
      setLocalCaps({ ...caps });
    });
    return () => {
      cancelled = true;
    };
  }, [businessId, fetchCapabilities]);

  const toggle = (key: string, value: boolean) => {
    setLocalCaps((prev) => (prev ? { ...prev, [key]: value } : prev));
    setMessage(null);
  };

  const handleSave = async () => {
    if (!businessId || !localCaps) return;
    setSaving(true);
    setMessage(null);
    try {
      const current = await apiGetCapabilities(businessId);
      if (!current.data) {
        setMessage('No se pudo guardar: sin conexión con tu cuenta.');
        return;
      }
      const caps: BusinessCapabilities = {
        restaurant: !!localCaps.restaurant,
        waiters: !!localCaps.waiters,
        tables: !!localCaps.tables,
        kitchen: !!localCaps.kitchen,
        kitchenPrinting: !!localCaps.kitchenPrinting,
      };
      const res = await apiUpdateCapabilities(businessId, {
        expectedCapabilityVersion: current.data.capabilityVersion,
        businessType: current.data.businessType,
        capabilities: caps,
      });
      if (!res.ok) {
        if (res.error?.code === 'VERSION_MISMATCH') {
          const fresh = await apiGetCapabilities(businessId);
          if (fresh.data) {
            const retry = await apiUpdateCapabilities(businessId, {
              expectedCapabilityVersion: fresh.data.capabilityVersion,
              businessType: fresh.data.businessType,
              capabilities: caps,
            });
            if (retry.ok) {
              setCapabilitiesCache(businessId, caps);
              setMessage('Características guardadas.');
              return;
            }
          }
        }
        setMessage(res.error?.message || 'No se pudo guardar.');
        return;
      }
      setCapabilitiesCache(businessId, caps);
      const fresh = await fetchCapabilities(businessId);
      if (fresh) setLocalCaps({ ...fresh });
      setMessage('Características guardadas.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text
            style={[
              styles.title,
              { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
            ]}
          >
            Configuración
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          CARACTERÍSTICAS DEL NEGOCIO
        </Text>
        <Card style={styles.cardList}>
          {FEATURES.map((f, i) => {
            const enabled = localCaps ? !!localCaps[f.key] : hasCapability(businessId, f.key);
            return (
              <View key={f.key}>
                <View style={styles.featureRow}>
                  <View style={[styles.featureIconCircle, { backgroundColor: colors.surfaceMuted }]}>
                    <Ionicons name={f.icon as any} size={20} color={enabled ? colors.primary : colors.textSecondary} />
                  </View>
                  <View style={styles.featureText}>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>{f.title}</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>{f.desc}</Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={(v) => toggle(f.key, v)}
                    disabled={!businessId || !localCaps}
                    trackColor={{ false: colors.border, true: colors.primaryLight }}
                    thumbColor={enabled ? colors.primary : colors.surfaceMuted}
                  />
                </View>
                {i < FEATURES.length - 1 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
              </View>
            );
          })}
        </Card>

        {!businessId ? (
          <Text style={[styles.featureHint, { color: colors.textSecondary, fontSize: typography.sizes.caption, marginTop: 8 }]}>
            Inicia sesión con tu cuenta para poder cambiar estas características:
          </Text>
        ) : null}

        {businessId && localCaps ? (
          <View style={[styles.saveRow, { gap: spacing.sm }]}>
            <PrimaryButton label="Guardar cambios" onPress={handleSave} loading={saving} />
            {message ? (
              <Text style={[styles.saveMessage, { color: colors.textSecondary, fontSize: typography.sizes.caption, textAlign: 'center' }]}>
                {message}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.gap} />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          VENTAS Y PAGOS
        </Text>
        <Card style={styles.cardList}>
          <SettingsRow
            icon="print-outline"
            title="Impresora"
            subtitle={available ? `Activa: ${statusLabel}` : statusLabel}
            onPress={() => navigation.navigate('PrinterConfig')}
          />
          <RowDivider />
          <SettingsRow
            icon="bar-chart-outline"
            title="Panel de ventas"
            subtitle="Resumen de los últimos 7 días"
            onPress={() => navigation.navigate('Dashboard')}
          />
        </Card>

        <View style={styles.gap} />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          CLIENTES
        </Text>
        <Card style={styles.cardList}>
          <SettingsRow
            icon="people-outline"
            title="Directorio de clientes"
            subtitle="Agrega, edita y elimina clientes"
            onPress={() => navigation.navigate('Customers')}
          />
        </Card>

        <View style={styles.gap} />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          PROVEEDORES
        </Text>
        <Card style={styles.cardList}>
          <SettingsRow
            icon="cube-outline"
            title="Directorio de proveedores"
            subtitle="Quiénes te surten el inventario"
            onPress={() => navigation.navigate('Providers')}
          />
        </Card>

        <View style={styles.gap} />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          CUENTA Y SEGURIDAD
        </Text>
        <Card style={styles.cardList}>
          <SettingsRow
            icon="cloud-outline"
            title="Datos y respaldo"
            subtitle="Exportar, restaurar o borrar"
            onPress={() => navigation.navigate('DatosYRespaldo')}
          />
          <RowDivider />
          <SettingsRow
            icon="shield-checkmark-outline"
            title="Seguridad"
            subtitle="Pregunta secreta y contraseña"
            onPress={() => navigation.navigate('Security')}
          />
        </Card>

        <Text style={[styles.footer, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          Los datos se guardan solo en este dispositivo.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.rowIcon, { opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name={icon} size={22} color={colors.textPrimary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

function RowDivider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    marginRight: 8,
    marginLeft: -6,
  },
  title: {
    letterSpacing: -0.5,
  },
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: 8,
  },
  gap: {
    height: 20,
  },
  rowIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontWeight: '600',
  },
  rowSubtitle: {
    marginTop: 2,
  },
  cardList: {
    padding: 14,
    gap: 8,
  },
  divider: {
    height: 1,
  },
  footer: {
    textAlign: 'center',
    marginTop: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  featureIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontWeight: '600',
  },
  featureDesc: {
    marginTop: 1,
  },
  featureHint: {
    lineHeight: 18,
  },
  saveRow: {
    marginTop: 12,
  },
  saveMessage: {
    marginTop: 4,
  },
});