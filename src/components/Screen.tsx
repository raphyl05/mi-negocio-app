import { SafeAreaView } from 'react-native-safe-area-context';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

type ScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function Screen({ children, style }: ScreenProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      {children}
    </SafeAreaView>
  );
}