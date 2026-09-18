import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../components/Screen';
import { useTheme } from '../../theme';

export default function LoginScreen() {
  const { colors, typography } = useTheme();

  return (
    <Screen>
      <View style={styles.screen}>
        <View style={styles.brand}>
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
            Tu configuración se guardó. El login real llega en la Fase 5.
          </Text>
        </View>

        <Text style={[styles.note, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
          Fase 4 — Configuración inicial lista
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  brand: {
    alignItems: 'center',
    gap: 12,
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
    lineHeight: 22,
  },
  note: {
    marginTop: 32,
  },
});