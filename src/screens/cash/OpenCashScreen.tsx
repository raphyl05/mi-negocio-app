import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../../components/PrimaryButton';
import Screen from '../../components/Screen';
import TextField from '../../components/TextField';
import { openRegister } from '../../services/cashRegisterService';
import { useTheme } from '../../theme';
import { parseMoney } from '../../utils/money';

type OpenCashScreenProps = {
  onOpened: () => void;
};

export default function OpenCashScreen({ onOpened }: OpenCashScreenProps) {
  const { colors, spacing, typography } = useTheme();

  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    const cents = parseMoney(amountText);
    if (cents === null) {
      setError('Ingresa un monto válido, por ejemplo 500 o 500.50');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await openRegister(cents);
      onOpened();
    } catch {
      setError('No se pudo abrir la caja. Inténtalo de nuevo.');
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
              <Ionicons name="cash-outline" size={36} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.title,
                { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
              ]}
            >
              Abrir caja
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: typography.sizes.body }]}>
              Registra el efectivo con el que empiezas hoy. Sin caja abierta no se pueden hacer ventas.
            </Text>
          </View>

          <View style={styles.form}>
            <TextField
              label="Efectivo inicial (RD$)"
              value={amountText}
              onChangeText={(text) => {
                setAmountText(text);
                setError(null);
              }}
              error={error ?? undefined}
              keyboardType="decimal-pad"
              placeholder="Ej. 500 o 500.50"
            />
          </View>

          <View style={styles.action}>
            <PrimaryButton label="Abrir caja" onPress={handleOpen} loading={loading} />
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
    lineHeight: 22,
  },
  form: {
    gap: 16,
  },
  action: {
    marginTop: 24,
  },
});