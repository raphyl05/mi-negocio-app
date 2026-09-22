import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import Column from '../../components/Column';
import Screen from '../../components/Screen';
import { useTheme } from '../../theme';
import {
  exportBackupToShare,
  restoreBackupFromFile,
  deleteAccountAndData,
  buildBackupBundle,
  applyRestoredBundle,
} from '../../services/backupService';
import {
  apiListCloudBackups,
  apiUploadCloudBackup,
  apiDownloadCloudBackup,
} from '../../services/authApi';
import { serializeBackup, parseBackup } from '../../utils/backup';
import { reportStorage, formatBytes, type StorageReport } from '../../services/storageMaintenance';
import { useAuth } from '../../contexts/AuthContext';
import type { RootStackParamList } from '../../navigation/types';

export default function DatosYRespaldoScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { logout, session } = useAuth();
  const [storage, setStorage] = useState<StorageReport | null>(null);
  const [cloudLast, setCloudLast] = useState<string | null>(null);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [cloudBusy, setCloudBusy] = useState<'upload' | 'restore' | null>(null);
  const businessId = session?.businesses[0]?.id ?? '';

  const refreshStorage = useCallback(async () => {
    setStorage(await reportStorage());
  }, []);

  const refreshCloud = useCallback(async () => {
    if (!businessId) {
      setCloudLoaded(true);
      return;
    }
    setCloudLast(null);
    const res = await apiListCloudBackups(businessId);
    if (res.data && res.data.length > 0) {
      const dates = res.data.map((b) => new Date(b.createdAt).getTime());
      const latest = new Date(Math.max(...dates));
      setCloudLast(latest.toLocaleString());
    } else {
      setCloudLast(null);
    }
    setCloudLoaded(true);
  }, [businessId]);

  useEffect(() => {
    refreshStorage();
  }, [refreshStorage]);

  useEffect(() => {
    refreshCloud();
  }, [refreshCloud]);

  const handleUploadCloud = () => {
    Alert.alert('Subir respaldo a la nube', 'Se subirá una copia de TODOS tus datos a tu cuenta. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Subir',
        onPress: async () => {
          setCloudBusy('upload');
          try {
            const bundle = await buildBackupBundle();
            const res = await apiUploadCloudBackup(businessId, serializeBackup(bundle));
            if (!res.ok) {
              Alert.alert('No se pudo subir', res.error?.message || 'Ocurrió un error.');
            } else {
              await refreshCloud();
              Alert.alert('Respaldo subido', 'Tu respaldo quedó guardado en tu cuenta.');
            }
          } catch {
            Alert.alert('Error', 'No se pudo subir el respaldo.');
          } finally {
            setCloudBusy(null);
          }
        },
      },
    ]);
  };

  const handleRestoreCloud = () => {
    Alert.alert(
      'Restaurar respaldo de la nube',
      'Se reemplazarán los datos de este dispositivo por el respaldo más reciente de tu cuenta. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: async () => {
            setCloudBusy('restore');
            try {
              const res = await apiDownloadCloudBackup(businessId);
              if (!res.ok || res.data === undefined) {
                Alert.alert('No se pudo descargar', res.error?.message || 'Aún no tienes respaldos en tu cuenta.');
                return;
              }
              const parsed = parseBackup(JSON.stringify(res.data.payload));
              if (!parsed.ok) {
                Alert.alert('Respaldo no válido', parsed.message);
                return;
              }
              await applyRestoredBundle(parsed.bundle);
              await refreshCloud();
            } catch {
              Alert.alert('Error', 'No se pudo restaurar el respaldo.');
            } finally {
              setCloudBusy(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert('Borrar cuenta', 'Se borrarán TODOS los datos de este dispositivo. ¿Continuar?', [
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
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Column>
          <Text style={[styles.pageTitle, { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold }]}>
            Datos y respaldo
          </Text>

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
            <Ionicons name="download-outline" size={22} color={colors.primary} />
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
          RESPALDO EN LA NUBE (tu cuenta)
        </Text>
        <Card style={styles.cardList}>
          {!businessId ? (
            <View style={styles.actionRow}>
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                  No hay cuenta en la nube
                </Text>
                <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                  Inicia sesión (con tu correo o teléfono) para activar el respaldo en la nube.
                </Text>
              </View>
              <Ionicons name="cloud-offline-outline" size={22} color={colors.textSecondary} />
            </View>
          ) : (
            <>
              <View style={styles.actionRow}>
                <View style={styles.actionText}>
                  <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                    Último respaldo
                  </Text>
                  <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                    {cloudLoaded
                      ? cloudLast
                        ? cloudLast
                        : 'Aún no hay respaldos en tu cuenta.'
                      : 'Consultando…'}
                  </Text>
                </View>
                <Ionicons name="cloud-done-outline" size={22} color={cloudLast ? colors.success : colors.textSecondary} />
              </View>
              <View style={styles.divider} />
              <Pressable onPress={cloudBusy ? undefined : handleUploadCloud} style={styles.actionRow}>
                <View style={styles.actionText}>
                  <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                    Subir respaldo
                  </Text>
                  <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                    Copia todos tus datos a tu cuenta (si pierdes el teléfono, los recuperas aquí).
                  </Text>
                </View>
                {cloudBusy === 'upload' ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
                )}
              </Pressable>
              <View style={styles.divider} />
              <Pressable onPress={cloudBusy ? undefined : handleRestoreCloud} style={styles.actionRow}>
                <View style={styles.actionText}>
                  <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                    Restaurar desde la nube
                  </Text>
                  <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                    Reemplaza este dispositivo con el respaldo más reciente de tu cuenta.
                  </Text>
                </View>
                {cloudBusy === 'restore' ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="cloud-download-outline" size={22} color={colors.primary} />
                )}
              </Pressable>
            </>
          )}
        </Card>
        <Pressable onPress={refreshCloud} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
          <Text style={{ color: colors.primary, fontSize: typography.sizes.caption, fontWeight: '600' }}>
            Actualizar estado de la nube
          </Text>
        </Pressable>

        <View style={styles.gap} />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          ALMACENAMIENTO
        </Text>
        <Card style={styles.cardList}>
          <View style={styles.actionRow}>
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                Base de datos
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                {formatBytes((storage?.databaseBytes ?? 0) + (storage?.walBytes ?? 0))} en este dispositivo
              </Text>
            </View>
            <Ionicons name="server-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.divider} />
          <View style={styles.actionRow}>
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                Caché de imágenes
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                {formatBytes(storage?.cacheBytes ?? 0)} (se limpia sola automáticamente)
              </Text>
            </View>
            <Ionicons name="images-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.divider} />
          <View style={styles.actionRow}>
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }]}>
                Respaldos automáticos
              </Text>
              <Text style={[styles.actionSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                {storage?.backupCount ?? 0} archivo(s), {formatBytes(storage?.backupsBytes ?? 0)}
              </Text>
            </View>
            <Ionicons name="archive-outline" size={22} color={colors.primary} />
          </View>
        </Card>

        <Pressable onPress={refreshStorage} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
          <Text style={{ color: colors.primary, fontSize: typography.sizes.caption, fontWeight: '600' }}>
            Actualizar tamaños
          </Text>
        </Pressable>

        <View style={styles.gap} />

        <Pressable onPress={handleDeleteAccount} style={[styles.dangerCard]}>
          <View style={styles.dangerText}>
            <Text style={[styles.dangerTitle, { color: colors.danger, fontSize: typography.sizes.body, fontWeight: '700' }]}>Borrar cuenta y datos</Text>
            <Text style={[styles.dangerSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              Elimina todos los datos locales y cierra la sesión.
            </Text>
          </View>
          <Ionicons name="trash-outline" size={22} color={colors.danger} />
        </Pressable>

        <Text style={[styles.footer, { color: colors.textSecondary, fontSize: typography.sizes.caption, marginTop: spacing.xl }]}>
          Los datos se guardan solo en este dispositivo.
        </Text>
        </Column>
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
  dangerCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#EF444440', backgroundColor: '#EF444410' },
  dangerText: { flex: 1, marginRight: 12 },
  dangerTitle: {},
  dangerSubtitle: { marginTop: 2 },
  footer: { textAlign: 'center' },
});