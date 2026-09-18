import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme';

type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
};

export default function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: PrimaryButtonProps) {
  const { colors, spacing, typography, shadows } = useTheme();

  const isPrimary = variant === 'primary';
  const backgroundColor = isPrimary ? colors.primary : colors.surface;
  const textColor = isPrimary ? colors.textOnPrimary : colors.primary;
  const borderColor = isPrimary ? colors.primary : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          borderRadius: 16,
          paddingVertical: spacing.md,
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          boxShadow: isPrimary ? shadows.button : undefined,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color: textColor,
              fontSize: typography.sizes.label,
              fontWeight: typography.weights.bold,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 24,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});