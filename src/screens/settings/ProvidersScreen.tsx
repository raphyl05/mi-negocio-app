import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import EmptyState from '../../components/EmptyState';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import TextField from '../../components/TextField';
import type { Provider } from '../../models/provider';
import { providerRepository } from '../../repositories/providerRepository';
import { useTheme } from '../../theme';
import { formatPhoneBlur, unformatPhoneFocus, sanitizePhoneInput } from '../../utils/inputFormat';

export default function ProvidersScreen() {
  const { colors, spacing, typography } = useTheme();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setProviders(await providerRepository.list());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openNew = () => {
    setEditing(null);
    setName('');
    setPhone('');
    setAddress('');
    setNote('');
    setShowForm(true);
  };

  const openEdit = (provider: Provider) => {
    setEditing(provider);
    setName(provider.name);
    setPhone(provider.phone);
    setAddress(provider.address);
    setNote(provider.note);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Escribe el nombre del proveedor.');
      return;
    }
    setSaving(true);
    try {
      const createdAt = editing?.createdAt ?? new Date().toISOString();
      await providerRepository.create({ id: editing?.id, name: name.trim(), phone: phone.trim(), address: address.trim(), note: note.trim(), createdAt });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (provider: Provider) => {
    Alert.alert('Eliminar proveedor', `Se eliminará a "${provider.name}". Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await providerRepository.remove(provider.id);
          await load();
        },
      },
    ]);
  };

  const manualMode = !showForm;

  return (
    <Screen>
      {manualMode ? (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
              ]}
            >
              Proveedores
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
              Quiénes te surten tu inventario y cómo contactarlos.
            </Text>
          </View>

          <FlatList
            data={providers}
            keyExtractor={(provider) => provider.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              loading ? null : (
                <EmptyState
                  icon="cube-outline"
                  title="Sin proveedores todavía"
                  subtitle="Agrega tu primer proveedor y aparecerá aquí y en el catálogo."
                />
              )
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => openEdit(item)}
                style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderRadius: 16, opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
                  <Text style={{ color: colors.primary, fontSize: typography.sizes.h2, fontWeight: '700' }}>
                    {item.name.trim().charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>{item.name}</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                    {[item.phone, item.address].filter(Boolean).join(' · ') || 'Sin datos extra'}
                  </Text>
                </View>
                <Pressable onPress={() => handleDelete(item)} hitSlop={8} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </Pressable>
            )}
          />

          <View style={styles.action}>
            <PrimaryButton label="Agregar proveedor" onPress={openNew} />
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.formContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              style={[
                styles.title,
                { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
              ]}
            >
              {editing ? 'Editar proveedor' : 'Nuevo proveedor'}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, marginBottom: 12 }}>
              Solo el nombre es obligatorio.
            </Text>
            <TextField label="Nombre *" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Ej. Distribuidora López" formatOnFocus={undefined} formatOnBlur={undefined} />
            <TextField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="809-000-0000" formatOnFocus={unformatPhoneFocus} formatOnBlur={formatPhoneBlur} sanitize={sanitizePhoneInput} />
            <TextField label="Dirección" value={address} onChangeText={setAddress} placeholder="Dirección del proveedor" />
            <TextField label="Nota" value={note} onChangeText={setNote} placeholder="Ej. Despacha cada lunes" />
            <View style={styles.formActions}>
              <PrimaryButton label={editing ? 'Guardar cambios' : 'Guardar proveedor'} onPress={handleSave} loading={saving} />
              <PrimaryButton label="Cancelar" variant="outline" onPress={() => setShowForm(false)} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingBottom: 8,
  },
  flex: {
    flex: 1,
  },
  formContainer: {
    flexGrow: 1,
    padding: 24,
    gap: 14,
    paddingBottom: 40,
  },
  header: {
    gap: 6,
    marginBottom: 16,
  },
  title: {
    letterSpacing: -0.5,
  },
  list: {
    paddingBottom: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  deleteBtn: {
    padding: 6,
  },
  action: {
    marginTop: 8,
  },
  formActions: {
    gap: 12,
    marginTop: 8,
  },
});