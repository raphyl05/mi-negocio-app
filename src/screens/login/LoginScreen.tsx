import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import TextField from '../../components/TextField';
import { verifyLogin } from '../../services/setupService';
import { useTheme } from '../../theme';
import { validateLogin } from '../../utils/loginValidation';
import type { LoginErrors } from '../../utils/loginValidation';

type LoginScreenProps = {
  onLogin: () => void;
};

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const { colors, spacing, typography } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const nextErrors = validateLogin({ username, password });
    setErrors(nextErrors);
    setGeneralError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const user = await verifyLogin(username, password);
      if (!user) {
        setGeneralError('Usuario o contraseña incorrectos.');
        return;
      }
      onLogin();
    } catch {
      setGeneralError('No se pudo iniciar sesión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="key-outline" size={36} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.title,
                { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
              ]}
            >
              Iniciar sesión
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
              Ingresa con tu usuario y contraseña
            </Text>
          </View>

          {generalError ? (
            <View style={[styles.banner, { backgroundColor: colors.danger }]}>
              <Text style={[styles.bannerText, { color: colors.white }]}>{generalError}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <TextField
              label="Usuario"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                setGeneralError(null);
              }}
              error={errors.username}
              placeholder="Tu usuario"
              autoCapitalize="none"
            />
            <TextField
              label="Contraseña"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setGeneralError(null);
              }}
              error={errors.password}
              secureTextEntry
              placeholder="Tu contraseña"
            />
          </View>

          <View style={styles.action}>
            <PrimaryButton label="Entrar" onPress={handleSubmit} loading={loading} />
          </View>
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
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: 'center',
  },
  banner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  action: {
    marginTop: 24,
  },
});