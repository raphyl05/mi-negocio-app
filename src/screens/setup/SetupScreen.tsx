import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Column from '../../components/Column';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import TextField from '../../components/TextField';
import { saveSetup } from '../../services/setupService';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../theme';
import { formatPhoneBlur, unformatPhoneFocus, sanitizePhoneInput } from '../../utils/inputFormat';
import { isApiReachable } from '../../services/authApi';
import { getDeviceId } from '../../utils/syncIdentity';
import { validateSetup } from '../../utils/setupValidation';
import type { SetupErrors } from '../../utils/setupValidation';

type SetupScreenProps = {
  onCompleted: () => void;
};

export default function SetupScreen({ onCompleted }: SetupScreenProps) {
  const { colors, spacing, typography } = useTheme();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<SetupErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const nextErrors = validateSetup({ name, username, password, confirmPassword, email, phone });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setGeneralError(null);
    let savedLocally = false;
    try {
      const reachable = await isApiReachable();
      if (reachable) {
        const deviceId = await getDeviceId();
        const res = await register(name, username, password, deviceId, { email, phone });
        if (res.ok) {
          setSaved(true);
          return;
        }
        if (res.error?.code === 'NETWORK') {
          setGeneralError('Sin conexion. Guardando localmente.');
        } else {
          setGeneralError('No se pudo contactar el servidor. Guardando localmente.');
        }
      } else {
        setGeneralError('Sin conexion. Guardando localmente.');
      }
      await saveSetup({ name, ownerName, email, phone, address, username, password });
      savedLocally = true;
      setSaved(true);
    } catch {
      if (!savedLocally) {
        setErrors({ username: 'No se pudo guardar la configuración. Inténtalo de nuevo.' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <Screen>
        <View style={styles.success}>
          <View style={[styles.successIcon, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={44} color={colors.white} />
          </View>
          <Text
            style={[
              styles.successTitle,
              { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
            ]}
          >
            ¡Todo listo!
          </Text>
          <Text style={[styles.successText, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
            Tu negocio quedó configurado correctamente.
          </Text>
          <View style={styles.successAction}>
            <PrimaryButton label="Ir al login" onPress={onCompleted} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Column>
            <View style={styles.header}>
            <View style={[styles.logoCircle, { backgroundColor: colors.primaryLight, overflow: 'hidden' }]}>
              <Image source={require('../../../assets/logo-vendelo-app.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <Text
              style={[
                styles.title,
                { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
              ]}
            >
              Configura tu negocio
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
              Solo necesitas hacerlo una vez
            </Text>
          </View>

          {generalError ? (
            <View style={[styles.banner, { backgroundColor: colors.danger }]}>
              <Text style={{ color: colors.white, fontSize: typography.sizes.body, textAlign: 'center' }}>{generalError}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <TextField label="Nombre del negocio *" value={name} onChangeText={setName} error={errors.name} placeholder="Ej. Hamburguesas El Rápido" />
            <TextField label="Propietario (opcional)" value={ownerName} onChangeText={setOwnerName} placeholder="Tu nombre" />
            <TextField
              label="Usuario *"
              value={username}
              onChangeText={setUsername}
              error={errors.username}
              placeholder="Ej. vendedor1"
              autoCapitalize="none"
            />
            <TextField label="Contraseña *" value={password} onChangeText={setPassword} error={errors.password} secureTextEntry placeholder="Mínimo 4 caracteres" />
            <TextField
              label="Confirmar contraseña *"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              error={errors.confirmPassword}
              secureTextEntry
              placeholder="Repite la contraseña"
            />
            <TextField label="Teléfono (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="809-000-0000" formatOnFocus={unformatPhoneFocus} formatOnBlur={formatPhoneBlur} sanitize={sanitizePhoneInput} />
            <TextField label="Correo electrónico (opcional)" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none" placeholder="tucorreo@ejemplo.com" />
            <TextField label="Dirección (opcional)" value={address} onChangeText={setAddress} placeholder="Dirección del negocio" />
          </View>

          <View style={styles.action}>
            <PrimaryButton label="Continuar" onPress={handleSubmit} loading={saving} />
          </View>
          </Column>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 6,
  },
  form: {
    gap: 16,
  },
  banner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  action: {
    marginTop: 24,
  },
  success: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successTitle: {
    letterSpacing: -0.5,
  },
  successText: {
    textAlign: 'center',
  },
  successAction: {
    alignSelf: 'stretch',
    marginTop: 16,
  },
});