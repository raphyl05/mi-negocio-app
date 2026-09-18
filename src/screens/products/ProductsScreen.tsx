import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import EmptyState from '../../components/EmptyState';
import MoneyDisplay from '../../components/MoneyDisplay';
import ProductImage from '../../components/ProductImage';
import Screen from '../../components/Screen';
import type { Product } from '../../models/product';
import type { RootStackParamList } from '../../navigation/types';
import { productRepository } from '../../repositories/productRepository';
import { useTheme } from '../../theme';

export default function ProductsScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [products, setProducts] = useState<Product[]>([]);

  const load = useCallback(async () => {
    const all = await productRepository.list();
    setProducts(all);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const sorted = [...products].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text
            style={[
              styles.title,
              { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
            ]}
          >
            Productos
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
            {products.length} productos en el catálogo
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('ProductForm')}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="add" size={26} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      {sorted.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="Sin productos"
          subtitle="Toca el botón + para crear tu primer producto."
        />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <ProductRow product={item} />}
        />
      )}
    </Screen>
  );
}

function ProductRow({ product }: { product: Product }) {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const outOfStock = product.trackStock && product.stockQuantity <= 0;

  return (
    <Pressable
      onPress={() => navigation.navigate('ProductForm', { productId: product.id })}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, opacity: pressed ? 0.9 : product.active ? 1 : 0.55 },
      ]}
    >
      <ProductImage product={product} size={48} />
      <View style={styles.rowInfo}>
        <Text
          numberOfLines={1}
          style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }}
        >
          {product.name}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
          {product.category}
        </Text>
        {!product.active ? (
          <Text style={{ color: colors.warning, fontSize: typography.sizes.caption, fontWeight: '700' }}>Inactivo oculto</Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        <MoneyDisplay cents={product.priceCents} size="small" />
        {product.trackStock ? (
          <Text
            style={{
              color: outOfStock ? colors.danger : colors.textSecondary,
              fontSize: typography.sizes.caption,
              fontWeight: '600',
            }}
          >
            Stock: {product.stockQuantity}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.border} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    letterSpacing: -0.5,
  },
  headerLeft: {
    flex: 1,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 24,
    gap: 10,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
  },
  rowInfo: {
    flex: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  chevron: {
    alignSelf: 'center',
  },
});