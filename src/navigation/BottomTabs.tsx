import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';
import { usePendingOrders } from '../contexts/PendingOrdersContext';
import HomeScreen from '../screens/home/HomeScreen';
import ProductsScreen from '../screens/products/ProductsScreen';
import VentasScreen from '../screens/sales/VentasScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import { useTheme } from '../theme';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<keyof TabParamList, { active: IconName; inactive: IconName }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Sales: { active: 'receipt', inactive: 'receipt-outline' },
  Products: { active: 'cube', inactive: 'cube-outline' },
  Settings: { active: 'apps', inactive: 'apps-outline' },
};

export default function BottomTabs() {
  const { colors, typography } = useTheme();
  const { pendingCount } = usePendingOrders();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontWeight: typography.weights.semibold,
          fontSize: typography.sizes.caption,
          marginBottom: 4,
        },
        tabBarIcon: ({ color, size }) => {
          const icons = ICONS[route.name];
          return <Ionicons name={icons.active} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Inicio' }} />
      <Tab.Screen
        name="Sales"
        component={VentasScreen}
        options={{
          title: 'Ventas',
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.danger,
            color: colors.white,
            fontSize: 10,
            fontWeight: '800',
            minWidth: 18,
          },
        }}
      />
      <Tab.Screen name="Products" component={ProductsScreen} options={{ title: 'Productos' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Más' }} />
    </Tab.Navigator>
  );
}