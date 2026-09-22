import { StyleSheet, Text, View } from 'react-native';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../theme';

const TYPE_COLORS = {
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
};

export default function ToastHost() {
  const { colors } = useTheme();
  const { notifications, dismiss } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {notifications.map((n) => (
        <View
          key={n.id}
          style={[styles.toast, { backgroundColor: colors.surface, borderColor: TYPE_COLORS[n.type] }]}
          accessible={true}
          accessibilityRole="alert"
        >
          <Text style={[styles.message, { color: colors.textPrimary }]}>
            {n.message}
          </Text>
          <Text style={[styles.typeDot, { color: TYPE_COLORS[n.type] }]}>
            {' '}
            {n.type.toUpperCase()}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 80,
    pointerEvents: 'none',
  },
  toast: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    alignItems: 'center',
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  typeDot: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.7,
  },
});
