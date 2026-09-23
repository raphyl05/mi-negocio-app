import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import EmptyState from '../../components/EmptyState';
import Screen from '../../components/Screen';
import { useAuth } from '../../contexts/AuthContext';
import { apiListDevices, apiRevokeDevice, type DeviceInfo } from '../../services/authApi';
import { getDeviceId } from '../../utils/syncIdentity';
import { useTheme } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  cashier: 'Cajero',
  waiter: 'Mesero',
  kitchen: 'Cocina',
  printer: 'Impresora',
};

const ROLE_ICONS: Record<string, IconName> = {
  admin: 'shield-checkmark-outline',
  cashier: 'cash-outline',
  waiter: 'fast-food-outline',
  kitchen: 'restaurant-outline',
  printer: 'print-outline',
};

export default function DevicesScreen() {
  const { colors, typography } = useTheme();
  const { session } = useAuth();
  const businessId = session?.activeBusinessId ?? session?.businesses[0]?.id ?? '';

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      setError('No hay un negocio conectado.');
      return;
    }
    setLoading(true);
    setError(null);
    const [selfDevice, res] = await Promise.all([
      getDeviceId(),
      apiListDevices(businessId),
    ]);
    setSelfId(selfDevice);
    if (res.data) {
      setDevices(res.data);
    } else {
      setError(res.error?.message || 'No se pudieron cargar los dispositivos.');
    }
    setLoading(false);
  }, [businessId]);

  const handleRevoke = (device: DeviceInfo) => {
    Alert.alert(
      'Revocar dispositivo',
      `"${device.name || device.id}" perderá acceso a este negocio al instante.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revocar',
          style: 'destructive',
          onPress: async () => {
            if (!businessId) return;
            const res = await apiRevokeDevice(businessId, device.id);
            if (res.ok) {
              await load();
            } else {
              Alert.alert('No se pudo revocar', res.error?.message || 'Inténtalo de nuevo.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <Screen>
      <FlatList
        data={devices}
        keyExtractor={(device) => device.id}
        style={styles.list}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={load}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
              ]}
            >
              Dispositivos
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
              Equipos con acceso a este negocio. Revoca cualquiera que no reconozcas.
            </Text>
            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.danger + '22' }]}>
                <Text style={{ color: colors.danger, fontSize: typography.sizes.caption, fontWeight: '600' }}>{error}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <EmptyState
              icon="tablet-portrait-outline"
              title="Sin dispositivos"
              subtitle="Los equipos aparecen aquí cuando inician sesión."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const isSelf = item.id === selfId;
          const isActive = item.active;
          const role = item.role && ROLE_LABELS[item.role] ? ROLE_LABELS[item.role] : item.role || 'Acceso completo';
          return (
            <View style={[styles.row, { backgroundColor: colors.surface, borderRadius: 16 }]}>
              <View style={[styles.iconCircle, { backgroundColor: isActive ? colors.primaryLight : colors.surfaceMuted }]}>
                <Ionicons
                  name={item.role && ROLE_ICONS[item.role] ? ROLE_ICONS[item.role] : 'tablet-portrait-outline'}
                  size={22}
                  color={isActive ? colors.primary : colors.textSecondary}
                />
              </View>
              <View style={styles.rowText}>
                <View style={styles.rowTitleLine}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary, fontSize: typography.sizes.body }]} numberOfLines={1}>
                    {item.name || item.id}
                  </Text>
                  {isSelf ? (
                    <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
                      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>ESTE EQUIPO</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                  {role} · desde {formatDate(item.registeredAt)}
                </Text>
                <Text
                  style={{
                    color: isActive ? colors.success : colors.danger,
                    fontSize: typography.sizes.caption,
                    fontWeight: '700',
                  }}
                >
                  {isActive ? 'Activo' : 'Revocado'}
                </Text>
              </View>
              {isActive && !isSelf ? (
                <Pressable onPress={() => handleRevoke(item)} hitSlop={8} style={styles.revokeBtn}>
                  <Ionicons name="close-circle-outline" size={24} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 10,
    paddingBottom: 40,
  },
  header: {
    gap: 6,
    marginBottom: 8,
  },
  title: {
    letterSpacing: -0.5,
  },
  errorBanner: {
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    fontWeight: '600',
    flexShrink: 1,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rowSubtitle: {
    marginTop: 2,
  },
  revokeBtn: {
    padding: 6,
  },
});