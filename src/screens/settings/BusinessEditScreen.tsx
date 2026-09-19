import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import Column from '../../components/Column';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import TextField from '../../components/TextField';
import type { RootStackParamList } from '../../navigation/types';
import { logoDataUri } from '../../services/printerService';
import { getBusiness, saveBusiness } from '../../services/setupService';
import { useTheme } from '../../theme';
import { formatPhoneBlur, unformatPhoneFocus, sanitizePhoneInput } from '../../utils/inputFormat';

type Validation = { name?: string };

export default function BusinessEditScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [invoiceMessage, setInvoiceMessage] = useState('');
  const [logoBase64, setLogoBase64] = useState<string | undefined>(undefined);
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
      setInvoiceMessage(business.invoiceMessage ?? 'Gracias por su compra!');
      setLogoBase64(business.logoBase64);
      setLoaded(true);
    });
  }, []);

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.base64) {
      setLogoBase64(asset.base64);
      setErrors({});
    }
  };

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
        logoBase64,
        invoiceMessage: invoiceMessage.trim() || 'Gracias por su compra!',
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const logoUri = logoDataUri(logoBase64);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Column>
          <Text
            style={[
              styles.title,
              { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
            ]}
          >
            Mi negocio
          </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
          Estos datos y el logo aparecen en el ticket y la factura de impresión.
        </Text>

        <View style={styles.form}>
          <TextField label="Nombre del negocio" value={name} onChangeText={(t) => { setName(t); setErrors({}); }} error={errors.name} placeholder="Ej. Comedor El Buen Sabor" />
          <TextField label="Dueño / encargado" value={ownerName} onChangeText={setOwnerName} placeholder="Opcional" />
          <TextField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="809-000-0000" formatOnFocus={unformatPhoneFocus} formatOnBlur={formatPhoneBlur} sanitize={sanitizePhoneInput} />
          <TextField label="Dirección" value={address} onChangeText={setAddress} placeholder="Opcional" />

          <View style={styles.logoSection}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              LOGO DE LA FACTURA
            </Text>
            {logoUri ? (
              <View style={styles.logoBox}>
                <Image source={{ uri: logoUri }} style={styles.logo} resizeMode="contain" />
              </View>
            ) : (
              <View style={[styles.logoPlaceholder, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption, marginTop: 8 }}>
                  Sin logo
                </Text>
              </View>
            )}
            <View style={styles.logoActions}>
              <PrimaryButton label={logoBase64 ? 'Cambiar logo' : 'Elegir logo'} onPress={pickLogo} />
              {logoBase64 ? (
                <PrimaryButton label="Quitar logo" variant="outline" onPress={() => setLogoBase64(undefined)} />
              ) : null}
            </View>
          </View>

          <TextField
            label="Mensaje del ticket"
            value={invoiceMessage}
            onChangeText={setInvoiceMessage}
            multiline
            placeholder="Gracias por su compra!"
          />
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="Guardar cambios" onPress={handleSave} loading={saving} />
          <PrimaryButton label="Cancelar" variant="outline" onPress={() => navigation.goBack()} />
        </View>
        </Column>
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
  logoSection: {
    gap: 12,
  },
  sectionLabel: {
    letterSpacing: 1,
    fontWeight: '700',
  },
  logoBox: {
    alignItems: 'center',
    padding: 12,
  },
  logo: {
    width: 96,
    height: 96,
  },
  logoPlaceholder: {
    height: 110,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoActions: {
    gap: 10,
  },
  actions: {
    gap: 12,
    marginTop: 24,
  },
});