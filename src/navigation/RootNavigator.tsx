import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { usePendingOrders } from '../contexts/PendingOrdersContext';
import CartScreen from '../screens/cart/CartScreen';
import OrderDetailScreen from '../screens/orderDetail/OrderDetailScreen';
import PaymentMethodScreen from '../screens/payment/PaymentMethodScreen';
import OrderCompleteScreen from '../screens/payment/OrderCompleteScreen';
import PaymentScreen from '../screens/payment/PaymentScreen';
import ProductFormScreen from '../screens/productForm/ProductFormScreen';
import { useTheme } from '../theme';
import BottomTabs from './BottomTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { colors } = useTheme();
  const { refreshPending } = usePendingOrders();

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
    <NavigationContainer theme={navTheme} onStateChange={() => refreshPending()}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={BottomTabs} />
        <Stack.Screen name="Cart" component={CartScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Payment" component={PaymentScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="PaymentMethod" component={PaymentMethodScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="OrderComplete" component={OrderCompleteScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="ProductForm" component={ProductFormScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ animation: 'slide_from_right' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}