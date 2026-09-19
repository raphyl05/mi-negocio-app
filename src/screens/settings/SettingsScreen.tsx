import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Card from '../../components/Card';
import MoneyDisplay from '../../components/MoneyDisplay';
import Screen from '../../components/Screen';
import { useAuth } from '../../contexts/AuthContext';
import type { Business } from '../../models/business';
import type { CashRegister } from '../../models/cashRegister';
import type { RootStackParamList } from '../../navigation/types';
import { getOpenRegister } from '../../services/cashRegisterService';
import { getBusiness } from '../../services/setupService';
import { useTheme } from '../../theme';
import { formatTime } from '../../utils/datetime';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function SettingsScreen() {
  const { colors, spacing, typography, dark, setDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { logout } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [register, setRegister] = useState<CashRegister | null>(null);

  useFocusEffect(
    useCallback(() => {
      getBusiness().then(setBusiness);
      getOpenRegister().then(setRegister);
    }, []),
  );

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', 'Se cerrará tu sesión. Tus datos se conservan en el dispositivo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text
          style={[
            styles.pageTitle,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          Más
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          MI NEGOCIO
        </Text>
        <Pressable
          onPress={() => navigation.navigate('BusinessEdit')}
          style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderRadius: 16, opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="storefront-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>
              {business?.name ?? 'Sin configurar'}
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              {business?.address || business?.phone ? [business.address, business.phone].filter(Boolean).join(' · ') : 'Editar datos del negocio'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.gap} />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          CAJA
        </Text>
        <Card style={styles.cardList}>
          {register ? (
            <>
              <View style={styles.rowIcon}>
                <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="cash-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>
                    Caja abierta
                  </Text>
                  <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                    Desde las {formatTime(register.openedAt)} · inicial{' '}
                    <MoneyDisplay cents={register.openingAmountCents} size="small" />
                  </Text>
                </View>
              </View>
              <RowDivider />
              <SettingsRow
                icon="receipt-outline"
                title="Resumen del día y cierre"
                subtitle="Revisa el cuadre y cierra el turno"
                onPress={() => navigation.navigate('CashClosure')}
              />
            </>
          ) : (
            <View style={styles.rowIcon}>
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>
                  Caja cerrada
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                  Ábrela desde la pestaña Inicio
                </Text>
              </View>
            </View>
          )}
        </Card>

        <View style={styles.gap} />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          APARIENCIA
        </Text>
        <Card style={styles.cardList}>
          <View style={styles.rowIcon}>
            <View style={[styles.iconCircle, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name={dark ? 'moon' : 'moon-outline'} size={22} color={colors.textPrimary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>
                Tema oscuro
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                {dark ? 'Activado' : 'Desactivado'}
              </Text>
            </View>
            <Switch
              value={dark}
              onValueChange={setDark}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={dark ? colors.primary : colors.surfaceMuted}
            />
          </View>
        </Card>

        <View style={styles.gap} />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          CONFIGURACIÓN
        </Text>
        <Card style={styles.cardList}>
          <SettingsRow
            icon="settings-outline"
            title="Configuración"
            subtitle="Impresión, clientes, proveedores, respaldos y más"
            onPress={() => navigation.navigate('Configuration')}
          />
        </Card>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutRow, { borderColor: colors.danger + '55', opacity: pressed ? 0.75 : 1 }]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={{ color: colors.danger, fontSize: typography.sizes.body, fontWeight: '700' }}>Cerrar sesión</Text>
        </Pressable>

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
  pageTitle: {
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: 8,
  },
  gap: {
    height: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
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
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
  },
  footer: {
    textAlign: 'center',
    marginTop: 16,
  },
});