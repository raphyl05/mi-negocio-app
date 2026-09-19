import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

type ColumnProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function Column({ children, style }: ColumnProps) {
  return <View style={[styles.column, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  column: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});