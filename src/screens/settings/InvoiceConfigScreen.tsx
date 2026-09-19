import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../../components/Card';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import type { RootStackParamList } from '../../navigation/types';
import { logoDataUri } from '../../services/printerService';
import { getBusiness, saveBusiness } from '../../services/setupService';
import { useTheme } from '../../theme';

export default function InvoiceConfigScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [logoBase64, setLogoBase64] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBusiness().then((business) => setLogoBase64(business?.logoBase64));
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
    if (!asset.base64) return;
    setSaving(true);
    try {
      const business = await getBusiness();
      if (business) {
        await saveBusiness({ ...business, logoBase64: asset.base64 });
        setLogoBase64(asset.base64);
      }
    } finally {
      setSaving(false);
    }
  };

  const removeLogo = async () => {
    const business = await getBusiness();
    if (!business) return;
    await saveBusiness({ ...business, logoBase64: undefined });
    setLogoBase64(undefined);
  };

  const logoUri = logoDataUri(logoBase64);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          Factura · impresión
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
          El ticket se imprime con el nombre, teléfono, dirección y logo de tu negocio.
        </Text>

        <Card style={styles.card}>
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
          <View style={styles.actions}>
            <PrimaryButton label={logoBase64 ? 'Cambiar logo' : 'Elegir logo'} onPress={pickLogo} loading={saving} />
            {logoBase64 ? <PrimaryButton label="Quitar logo" variant="outline" onPress={removeLogo} /> : null}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
            FRANJA DE TICKET A 58 MM
          </Text>
          <Text style={[styles.note, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
            Al cobrar verás el ticket listo para imprimir (también puedes volver a verlo desde Ventas). El formato ya está
            preparado para la impresora.
          </Text>
        </Card>

        <View style={styles.actions}>
          <PrimaryButton label="Listo" variant="outline" onPress={() => navigation.goBack()} />
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
    marginBottom: 16,
  },
  card: {
    gap: 12,
    marginBottom: 16,
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
  actions: {
    gap: 10,
  },
  note: {
    lineHeight: 22,
  },
});