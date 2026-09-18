import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MoneyDisplay from '../../components/MoneyDisplay';
import Screen from '../../components/Screen';
import type { CashRegister } from '../../models/cashRegister';
import type { Product } from '../../models/product';
import { productRepository } from '../../repositories/productRepository';
import { useTheme } from '../../theme';
import { useCart } from '../../contexts/CartContext';
import { formatTime } from '../../utils/datetime';
import { formatMoney } from '../../utils/money';

type InvoiceScreenProps = {
  register: CashRegister;
};

export default function InvoiceScreen({ register }: InvoiceScreenProps) {
  const { colors, spacing, typography } = useTheme();
  const { count, subtotalCents, add } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');

  const load = useCallback(async () => {
    const all = await productRepository.list();
    setProducts(all);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = ['Todos', ...Array.from(new Set(products.map((p) => p.category)))];

  const filtered = products.filter((product) => {
    const matchesCategory = category === 'Todos' || product.category === category;
    const matchesQuery = product.name.toLowerCase().includes(query.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item }) => <ProductCard product={item} onAdd={() => add(item)} />}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text
                style={[
                  styles.title,
                  { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
                ]}
              >
                Facturación
              </Text>
              <Text style={[styles.cajaLine, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                Caja abierta desde las {formatTime(register.openedAt)}
              </Text>
            </View>

            <View style={styles.search}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar producto…"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    fontSize: typography.sizes.body,
                  },
                ]}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {categories.map((c) => {
                const active = c === category;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? colors.textOnPrimary : colors.textSecondary, fontSize: typography.sizes.caption },
                      ]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {filtered.length === 0 ? (
              <View style={[styles.emptyRow, { gap: spacing.md }]}>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
                  No hay productos que coincidan.
                </Text>
              </View>
            ) : null}
          </View>
        }
      />

      <View style={[styles.cartBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.cartInfo}>
          <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
            {count === 0 ? 'Carrito vacío' : `${count} ${count === 1 ? 'producto' : 'productos'}`}
          </Text>
          {count > 0 ? (
            <MoneyDisplay cents={subtotalCents} size="large" />
          ) : (
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>RD$0.00</Text>
          )}
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
          El carrito completo llega en la Fase 8
        </Text>
      </View>
    </Screen>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const { colors, spacing, typography, shadows } = useTheme();

  return (
    <View style={[styles.productCard, { backgroundColor: colors.surface, borderRadius: 16, boxShadow: shadows.card }]}>
      <Text style={styles.emoji}>{product.emoji ?? '🍽️'}</Text>
      <Text
        numberOfLines={2}
        style={[styles.productName, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }]}
      >
        {product.name}
      </Text>
      <Text style={[styles.productPrice, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>
        {formatMoney(product.priceCents)}
      </Text>
      <Pressable
        onPress={onAdd}
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={{ color: colors.textOnPrimary, fontSize: 20, fontWeight: '700', lineHeight: 22 }}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    marginBottom: 16,
  },
  title: {
    letterSpacing: -0.5,
  },
  cajaLine: {
    marginTop: 4,
  },
  search: {
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  chips: {
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontWeight: '600',
  },
  emptyRow: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  gridRow: {
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 12,
  },
  gridContent: {
    paddingBottom: 16,
  },
  productCard: {
    flex: 1,
    padding: 14,
    minHeight: 132,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  productName: {
    flex: 1,
  },
  productPrice: {
    fontWeight: '600',
    marginTop: 6,
  },
  addButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBar: {
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 10,
  },
  cartInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
});