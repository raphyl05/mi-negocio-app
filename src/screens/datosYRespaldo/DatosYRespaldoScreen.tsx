import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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