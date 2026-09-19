import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import EmptyState from '../../components/EmptyState';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import TextField from '../../components/TextField';
import type { Customer } from '../../models/customer';
import { customerRepository } from '../../repositories/customerRepository';
import { useTheme } from '../../theme';
import { formatPhoneBlur, unformatPhoneFocus, sanitizePhoneInput } from '../../utils/inputFormat';

export default function CustomersScreen() {
  const { colors, spacing, typography } = useTheme();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setCustomers(await customerRepository.list());
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

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setName(customer.name);
    setPhone(customer.phone);
    setAddress(customer.address);
    setNote(customer.note);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Escribe el nombre del cliente.');
      return;
    }
    setSaving(true);
    try {
      const createdAt = editing?.createdAt ?? new Date().toISOString();
      await customerRepository.create({ id: editing?.id, name: name.trim(), phone: phone.trim(), address: address.trim(), note: note.trim(), createdAt });
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (customer: Customer) => {
    Alert.alert('Eliminar cliente', `Se eliminará a "${customer.name}". Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await customerRepository.remove(customer.id);
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
              Clientes
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
              Clientela registrada para llenar tus facturas rápido.
            </Text>
          </View>

          <FlatList
            data={customers}
            keyExtractor={(customer) => customer.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              loading ? null : (
                <EmptyState
                  icon="people-outline"
                  title="Sin clientes todavía"
                  subtitle="Agrega tu primer cliente y aparcerá aquí y en el carrito."
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
            <PrimaryButton label="Agregar cliente" onPress={openNew} />
          </View>
        </View>
      ) : (
        <View style={styles.formContainer}>
          <Text
            style={[
              styles.title,
              { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
            ]}
          >
            {editing ? 'Editar cliente' : 'Nuevo cliente'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, marginBottom: 12 }}>
            Solo el nombre es obligatorio.
          </Text>
          <TextField label="Nombre *" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Ej. Juan Pérez" formatOnFocus={undefined} formatOnBlur={undefined} />
          <TextField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="809-000-0000" formatOnFocus={unformatPhoneFocus} formatOnBlur={formatPhoneBlur} sanitize={sanitizePhoneInput} />
          <TextField label="Dirección" value={address} onChangeText={setAddress} placeholder="Dirección del cliente" />
          <TextField label="Nota" value={note} onChangeText={setNote} placeholder="Ej. Prefiere entrega por la tarde" />
          <View style={styles.formActions}>
            <PrimaryButton label={editing ? 'Guardar cambios' : 'Guardar cliente'} onPress={handleSave} loading={saving} />
            <PrimaryButton label="Cancelar" variant="outline" onPress={() => setShowForm(false)} />
          </View>
        </View>
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
  formContainer: {
    flex: 1,
    padding: 24,
    gap: 14,
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