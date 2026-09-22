import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { usePrinter } from '../../hooks/usePrinter';
import { useAuth } from '../../contexts/AuthContext';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function ConfigurationScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { statusLabel, available } = usePrinter();
  const { session, hasCapability } = useAuth();
  const businessId = session?.businesses[0]?.id ?? '';

  const features = [
    { key: 'restaurant', icon: 'restaurant', title: 'Modo restaurante', desc: 'Comandas, mesas y cocina' },
    { key: 'waiters', icon: 'person', title: 'Meseros', desc: 'Asignar meseros a órdenes' },
    { key: 'tables', icon: 'list', title: 'Mesas', desc: 'Gestionar mesas y ocupación' },
    { key: 'kitchen', icon: 'walk', title: 'Cocina', desc: 'Comanda de cocina y estado' },
    { key: 'kitchenPrinting', icon: 'print', title: 'Impresión cocina', desc: 'Tickets de cocina automáticos' },
  ] as const;

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
          {features.map((f, i) => {
            const enabled = hasCapability(businessId, f.key);
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
                  <View style={[styles.featureBadge, { backgroundColor: enabled ? colors.success + '22' : colors.surfaceMuted }]}>
                    <Text style={[styles.featureBadgeText, { color: enabled ? colors.success : colors.textSecondary }]}>
                      {enabled ? 'ACTIVA' : 'INACTIVA'}
                    </Text>
                  </View>
                </View>
                {i < features.length - 1 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
              </View>
            );
          })}
        </Card>

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
  featureBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  featureBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});