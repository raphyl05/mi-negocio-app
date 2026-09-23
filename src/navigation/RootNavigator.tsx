import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { usePendingOrders } from '../contexts/PendingOrdersContext';
import CartScreen from '../screens/cart/CartScreen';
import OrderDetailScreen from '../screens/orderDetail/OrderDetailScreen';
import PaymentMethodScreen from '../screens/payment/PaymentMethodScreen';
import OrderCompleteScreen from '../screens/payment/OrderCompleteScreen';
import PaymentScreen from '../screens/payment/PaymentScreen';
import ProductFormScreen from '../screens/productForm/ProductFormScreen';
import CashClosureScreen from '../screens/cash/CashClosureScreen';
import BusinessEditScreen from '../screens/settings/BusinessEditScreen';
import DashboardScreen from '../screens/settings/DashboardScreen';
import PrinterConfigScreen from '../screens/settings/PrinterConfigScreen';
import SecurityScreen from '../screens/settings/SecurityScreen';
import CustomersScreen from '../screens/settings/CustomersScreen';
import ProvidersScreen from '../screens/settings/ProvidersScreen';
import DatosYRespaldoScreen from '../screens/datosYRespaldo/DatosYRespaldoScreen';
import ConfigurationScreen from '../screens/settings/ConfigurationScreen';
import KitchenScreen from '../screens/kitchen/KitchenScreen';
import DevicesScreen from '../screens/settings/DevicesScreen';
import BusinessSwitcherScreen from '../screens/settings/BusinessSwitcherScreen';
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
        <Stack.Screen name="CashClosure" component={CashClosureScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="BusinessEdit" component={BusinessEditScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="PrinterConfig" component={PrinterConfigScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Security" component={SecurityScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Customers" component={CustomersScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Providers" component={ProvidersScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="DatosYRespaldo" component={DatosYRespaldoScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Configuration" component={ConfigurationScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Kitchen" component={KitchenScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="Devices" component={DevicesScreen} options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="BusinessSwitcher" component={BusinessSwitcherScreen} options={{ animation: 'slide_from_right' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}