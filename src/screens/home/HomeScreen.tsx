import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Screen from '../../components/Screen';
import { useCart } from '../../contexts/CartContext';
import type { CashRegister } from '../../models/cashRegister';
import { getOpenRegister } from '../../services/cashRegisterService';
import { useTheme } from '../../theme';
import OpenCashScreen from '../cash/OpenCashScreen';
import InvoiceScreen from './InvoiceScreen';

export default function HomeScreen() {
  const { colors } = useTheme();
  const { clear } = useCart();
  const [register, setRegister] = useState<CashRegister | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const reg = await getOpenRegister();
    if (!reg) {
      clear();
    }
    setRegister(reg);
    setLoading(false);
  }, [clear]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!register) {
    return <OpenCashScreen onOpened={load} />;
  }

  return <InvoiceScreen register={register} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});