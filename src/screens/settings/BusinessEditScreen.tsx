import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import TextField from '../../components/TextField';
import type { RootStackParamList } from '../../navigation/types';
import { getBusiness, saveBusiness } from '../../services/setupService';
import { useTheme } from '../../theme';

type Validation = { name?: string };

export default function BusinessEditScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Validation>({});

  useEffect(() => {
    getBusiness().then((business) => {
      if (!business) return;
      setName(business.name);
      setOwnerName(business.ownerName ?? '');
      setPhone(business.phone ?? '');
      setAddress(business.address ?? '');
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      setErrors({ name: 'El nombre del negocio es obligatorio' });
      return;
    }
    setSaving(true);
    try {
      const existing = await getBusiness();
      await saveBusiness({
        name: name.trim(),
        ownerName: ownerName.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        logoBase64: existing?.logoBase64,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          Mi negocio
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
          Estos datos aparecen en el ticket de impresión.
        </Text>

        <View style={styles.form}>
          <TextField label="Nombre del negocio" value={name} onChangeText={(t) => { setName(t); setErrors({}); }} error={errors.name} placeholder="Ej. Comedor El Buen Sabor" />
          <TextField label="Dueño / encargado" value={ownerName} onChangeText={setOwnerName} placeholder="Opcional" />
          <TextField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="809-000-0000" />
          <TextField label="Dirección" value={address} onChangeText={setAddress} placeholder="Opcional" />
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="Guardar cambios" onPress={handleSave} loading={saving} />
          <PrimaryButton label="Cancelar" variant="outline" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  title: {
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 20,
  },
  form: {
    gap: 16,
  },
  actions: {
    gap: 12,
    marginTop: 24,
  },
});