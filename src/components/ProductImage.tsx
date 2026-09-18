import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import type { Product } from '../models/product';
import { useTheme } from '../theme';
import { DEFAULT_PRODUCT_EMOJI } from '../utils/productImages';

type ProductImageProps = {
  product: Product;
  size?: number;
};

export default function ProductImage({ product, size = 48 }: ProductImageProps) {
  const { colors } = useTheme();

  if (product.imageType === 'photo' && product.imageUri) {
    return (
      <Image
        source={{ uri: product.imageUri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 4,
          backgroundColor: colors.surfaceMuted,
        }}
      />
    );
  }

  if (product.imageType === 'icon' && product.icon) {
    return (
      <View
        style={[
          styles.container,
          { width: size, height: size, borderRadius: size / 4, backgroundColor: colors.primaryLight },
        ]}
      >
        <Ionicons name={product.icon as ComponentProps<typeof Ionicons>['name']} size={size * 0.6} color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 4, backgroundColor: colors.surfaceMuted },
      ]}
    >
      <Text style={{ fontSize: size * 0.5 }}>{product.emoji || DEFAULT_PRODUCT_EMOJI}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});