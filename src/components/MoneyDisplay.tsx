import { StyleSheet, Text } from 'react-native';
import type { ColorValue } from 'react-native';
import { useTheme } from '../theme';
import { formatMoney } from '../utils/money';

type MoneyDisplayProps = {
  cents: number;
  size?: 'small' | 'medium' | 'large';
  color?: ColorValue;
};

export default function MoneyDisplay({ cents, size = 'large', color }: MoneyDisplayProps) {
  const { colors, typography } = useTheme();

  const fontSize = size === 'large' ? typography.sizes.display : size === 'medium' ? typography.sizes.h2 : typography.sizes.label;
  const fontWeight = size === 'small' ? typography.weights.semibold : typography.weights.extrabold;

  return (
    <Text
      style={[
        styles.text,
        {
          color: color ?? colors.textPrimary,
          fontSize,
          fontWeight,
        },
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {formatMoney(cents)}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontVariant: ['tabular-nums'],
  },
});