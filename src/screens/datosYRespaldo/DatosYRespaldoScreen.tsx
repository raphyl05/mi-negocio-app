import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { useTheme } from '../../theme';
import { exportBackupToShare, restoreBackupFromFile, deleteAccountAndData } from '../../services/backupService';
import { useAuth } from '../../contexts/AuthContext';
import type { RootStackParamList } from '../../navigation/types';

export default function DatosYRespaldoScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { logout } = useAuth();

  const handleExport = async () => {
    Alert.alert('Exportar respaldo', 'Se compartirá el archivo JSON con tus datos. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Exportar', onPress: exportBackupToShare },
    ]);
  };

  const handleRestore = () => {
    Alert.alert('Restaurar respaldo', 'Se reemplazarán los datos actuales con los del archivo. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Importar', onPress: restoreBackupFromFile },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Eliminar cuenta',
      'Se borrarán TODOS los datos de este dispositivo (negocio, usuarios, clientes, productos, pedidos, caja y respaldo). Esto NO se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: async () => {
            await deleteAccountAndData();
            logout();
            navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
          },
        },
      ],
    );
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
          Datos y respaldo
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          RESPALDO
        </Text>
        <Card style={styles.cardList}>
          <Pressable onPress={handleExport} style={styles.actionRow}>
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                Exportar respaldo
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                Genera un archivo JSON para guardar o mover a otro dispositivo.
              </Text>
            </View>
            <Ionicons name={"download-outline" as any} size={22} color={colors.primary} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable onPress={handleRestore} style={styles.actionRow}>
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                Restaurar respaldo
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                Importa un archivo anterior.
              </Text>
            </View>
            <Ionicons name={"upload-outline" as any} size={22} color={colors.primary} />
          </Pressable>
        </Card>

        <View style={styles.gap} />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          ADVERTENCIA
        </Text>
        <Pressable onPress={handleDeleteAccount} style={styles.dangerCard}>
          <View style={styles.dangerText}>
            <Text style={[styles.dangerTitle, { color: colors.danger, fontSize: typography.sizes.body, fontWeight: '700' }]}>
              Borrar cuenta y datos
            </Text>
            <Text style={[styles.dangerSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              Elimina todos los datos locales y cierra la sesión. La copia de seguridad NO se restaura automáticamente.
            </Text>
          </View>
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
        </Pressable>

        <Text style={[styles.footer, { color: colors.textSecondary, fontSize: typography.sizes.caption, marginTop: spacing.xl }]}>
          Los respaldos contienen información sensible. Guárdalos como si fueran tu contraseña.
        </Text>
      </ScrollView>
    </Screen>
  );
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
  cardList: {
    padding: 14,
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'transparent',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  actionText: {
    flex: 1,
    marginRight: 12,
  },
  actionTitle: {},
  actionSubtitle: {
    marginTop: 2,
  },
  dangerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EF444440',
    backgroundColor: '#EF444410',
  },
  dangerText: {
    flex: 1,
    marginRight: 12,
  },
  dangerTitle: {},
  dangerSubtitle: {
    marginTop: 2,
  },
  footer: {
    textAlign: 'center',
  },
});
