import { Platform, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

// Android: el borde inferior evita que la barra de navegación del sistema corte los
// botones del fondo. En iOS/web el sistema ya lo respeta solo (tab bar / gesto home);
// forzar el borde inferior creaba una banda vacía innecesaria (barra fantasma).
const EDGES: ReadonlyArray<'top' | 'bottom' | 'left' | 'right'> = Platform.select({
  android: ['top', 'left', 'right', 'bottom'],
  default: ['top', 'left', 'right'],
});

// En pantallas anchas (tablet/web) el contenido se centra como columna de teléfono.
const MAX_CONTENT_WIDTH = 560;

type ScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function Screen({ children, style }: ScreenProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView edges={EDGES} style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.content, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
});