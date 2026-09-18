import { StyleSheet, View } from 'react-native';
import type { ViewProps } from 'react-native';
import { useTheme } from '../theme';

type CardProps = ViewProps & {
  padded?: boolean;
};

export default function Card({ style, padded = true, children, ...rest }: CardProps) {
  const { colors, spacing, shadows } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: 20,
          boxShadow: shadows.card,
          padding: padded ? spacing.md : 0,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexShrink: 1,
  },
});