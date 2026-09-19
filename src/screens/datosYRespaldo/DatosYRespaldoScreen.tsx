import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, Pressable, ScrollView, Switch, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import Screen from '../../components/Screen';
import { useTheme } from '../../theme';
import { exportBackupToShare, restoreBackupFromFile, deleteAccountAndData } from '../../services/backupService';
import { useAuth } from '../../contexts/AuthContext';
import { getDriveStatus, signInDrive, signOutDrive, uploadBackup, listBackups, downloadBackup } from '../../services/driveService';
import { getPendingCount } from '../../services/syncQueue';
import { useDriveSync } from '../../hooks/useDriveSync';
import type { RootStackParamList } from '../../navigation/types';

export default function DatosYRespaldoScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { logout } = useAuth();
  const [drive, setDrive] = useState<{ connected: false } | { connected: true; email: string }>({ connected: false });
  const [pending, setPending] = useState(0);
  const [autoSync, setAutoSync] = useState(true);
  const [busy, setBusy] = useState(false);
  useDriveSync();

  const refreshStatus = async () => {
    setDrive(await getDriveStatus());
    setPending(await getPendingCount());
  };

  const refreshStatusAndPending = async () => {
    await refreshStatus();
  };

  const handleSignIn = async () => {
    setBusy(true);
    const r = await signInDrive();
    setBusy(false);
    if (r.ok) {
      Alert.alert('Drive vinculado', `Cuenta: ${r.email}`);
      await refreshStatus();
    } else {
      Alert.alert('No se pudo vincular', r.message);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Desvincular Drive', '¿Quieres desvincular la cuenta de Google? Dejarás de sincronizar.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desvincular',
        style: 'destructive',
        onPress: async () => {
          await signOutDrive();
          await refreshStatus();
        },
      },
    ]);
  };

  const handleSaveDrive = async () => {
    if (!drive.connected) return;
    setBusy(true);
    Alert.alert('Guardar en Drive', 'Sube una copia completa de la app. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Subir',
        onPress: async () => {
          const result = await uploadBackupLocal();
          setBusy(false);
          Alert.alert(result.ok ? 'Copia lista' : 'Error al subir', result.ok ? 'Respaldo en Drive.' : result.message);
          await refreshStatusAndPending();
        },
      },
    ]);
  };

  const uploadBackupLocal = async (): Promise<{ ok: boolean; message: string }> => {
    const { buildBackupBundle } = await import('../../services/backupService');
    const bundle = await buildBackupBundle();
    const { uploadBackup } = await import('../../services/driveService');
    const r = await uploadBackup(bundle);
    return r.ok ? { ok: true, message: '' } : r;
  };

  const handleRestoreDrive = async () => {
    if (!drive.connected) return;
    setBusy(true);
    const { listBackups } = await import('../../services/driveService');
    const list = await listBackups();
    setBusy(false);
    if (!list.ok) { Alert.alert('Error', list.message); return; }
    if (list.items.length === 0) { Alert.alert('Sin respaldos', 'Aún no hay respaldos en Drive.'); return; }
    const latest = list.items[0];
    Alert.alert('Restaurar desde Drive', `Se restaurará: ${latest.name}. Esto reemplaza los datos actuales.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Restaurar',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const { downloadBackup } = await import('../../services/driveService');
          const { applyRestoredBundle } = await import('../../services/backupService');
          const r = await downloadBackup(latest.id);
          setBusy(false);
          if (!r.ok) { Alert.alert('Error', r.message); return; }
          await applyRestoredBundle(r.bundle);
          Alert.alert('Restaurado', 'Los datos se cargaron desde Drive.');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert('Borrar cuenta', 'Se borrarán TODOS los datos de este dispositivo. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar todo',
        style: 'destructive',
        onPress: async () => {
          await deleteAccountAndData();
          await signOutDrive();
          logout();
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={[styles.pageTitle, { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold }]}>
          Datos y respaldo
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>GOOGLE DRIVE</Text>
        <Card style={styles.cardList}>
          <View style={styles.statusRow}>
            <Text style={[styles.statusTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
              {drive.connected ? `Vinculada · ${drive.email}` : 'Sin cuenta vinculada'}
            </Text>
            {pending > 0 && (
              <Text style={{ color: colors.warning, fontSize: typography.sizes.caption }}>
                {pending} cierre{pending > 1 ? 's' : ''} pendiente{pending > 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <View style={styles.divider} />
          {drive.connected ? (
            <Pressable onPress={handleSignOut} style={styles.actionRow}>
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: colors.danger, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                  Desvincular cuenta de Google
                </Text>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                  Deja de sincronizar con Drive.
                </Text>
              </View>
              <Ionicons name="log-out-outline" size={22} color={colors.danger} />
            </Pressable>
          ) : (
            <Pressable onPress={handleSignIn} disabled={busy} style={styles.actionRow}>
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                  {busy ? 'Vinculando…' : 'Vincular cuenta de Google'}
                </Text>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                  Permite respaldo y restauración automática.
                </Text>
              </View>
              <Ionicons name="logo-google" size={22} color={colors.primary} />
            </Pressable>
          )}
          <View style={styles.divider} />
          <Pressable onPress={handleSaveDrive} disabled={!drive.connected || busy} style={{ opacity: drive.connected && !busy ? 1 : 0.5 }}>
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                Guardar respaldo en Drive
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                Sube una copia completa de la app.
              </Text>
            </View>
            <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable onPress={handleRestoreDrive} disabled={!drive.connected || busy} style={{ opacity: drive.connected && !busy ? 1 : 0.5 }}>
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                Restaurar desde Drive
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                Usa una copia guardada en Drive (cambiar de dispositivo o intencional).
              </Text>
            </View>
            <Ionicons name="cloud-download-outline" size={22} color={colors.primary} />
          </Pressable>
        </Card>

        <View style={styles.gap} />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          ARCHIVO (universal)
        </Text>
        <Card style={styles.cardList}>
          <Pressable onPress={() => Alert.alert('Exportar respaldo', '¿Continuar?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Exportar', onPress: exportBackupToShare },
          ])} style={styles.actionRow}>
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>Exportar respaldo</Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                Genera un archivo JSON (WhatsApp, email, AirDrop…).
              </Text>
            </View>
            <Ionicons name={"download-outline" as any} size={22} color={colors.primary} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable onPress={() => Alert.alert('Restaurar respaldo', '¿Continuar?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Importar', onPress: restoreBackupFromFile },
          ])} style={styles.actionRow}>
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>Restaurar respaldo</Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                Importa un archivo anterior.
              </Text>
            </View>
            <Ionicons name={"upload-outline" as any} size={22} color={colors.primary} />
          </Pressable>
        </Card>

        <View style={styles.gap} />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          CONFIGURACIÓN
        </Text>
        <Card style={styles.cardList}>
          <View style={styles.syncRow}>
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                Sync automático al cerrar caja
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                Solo si Drive está vinculado. Pendientes se suben al reconectar.
              </Text>
            </View>
            <Switch value={autoSync} onValueChange={(v) => { setAutoSync(v); }} trackColor={{ false: colors.border, true: colors.primaryLight }} />
          </View>
        </Card>

        <View style={styles.gap} />

        <Pressable onPress={handleDeleteAccount} style={[styles.dangerCard]}>
          <View style={styles.dangerText}>
            <Text style={[styles.dangerTitle, { color: colors.danger, fontSize: typography.sizes.body, fontWeight: '700' }]}>Borrar cuenta y datos</Text>
            <Text style={[styles.dangerSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              Elimina todos los datos locales y cierra la sesión. Drive se desvincula.
            </Text>
          </View>
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
        </Pressable>

        <Text style={[styles.footer, { color: colors.textSecondary, fontSize: typography.sizes.caption, marginTop: spacing.xl }]}>
          Los respaldos y el token de Drive son tan sensibles como tu contraseña.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 40 },
  pageTitle: { letterSpacing: -0.5, marginBottom: 16 },
  sectionLabel: { letterSpacing: 1, marginBottom: 8 },
  gap: { height: 20 },
  cardList: { padding: 14, gap: 8 },
  divider: { height: 1, backgroundColor: 'transparent' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  actionText: { flex: 1, marginRight: 12 },
  actionTitle: {},
  actionSubtitle: { marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusTitle: {},
  syncRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dangerCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#EF444440', backgroundColor: '#EF444410' },
  dangerText: { flex: 1, marginRight: 12 },
  dangerTitle: {},
  dangerSubtitle: { marginTop: 2 },
  footer: { textAlign: 'center' },
});
