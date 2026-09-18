import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CartScreen from '../screens/cart/CartScreen';
import OrderCompleteScreen from '../screens/payment/OrderCompleteScreen';
import PaymentMethodScreen from '../screens/payment/PaymentMethodScreen';
import PaymentScreen from '../screens/payment/PaymentScreen';
import { useTheme } from '../theme';
import BottomTabs from './BottomTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { colors } = useTheme();

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={BottomTabs} />
        <Stack.Screen name="Cart" component={CartScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Payment" component={PaymentScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="OrderComplete" component={OrderCompleteScreen} options={{ animation: 'fade' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}