import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MoneyDisplay from '../../components/MoneyDisplay';
import ProductImage from '../../components/ProductImage';
import Screen from '../../components/Screen';
import { useCart } from '../../contexts/CartContext';
import type { CashRegister } from '../../models/cashRegister';
import type { RootStackParamList } from '../../navigation/types';
import type { Product } from '../../models/product';
import { productRepository } from '../../repositories/productRepository';
import { useTheme } from '../../theme';
import { formatTime } from '../../utils/datetime';
import { formatMoney } from '../../utils/money';
import { inCartQuantity, parseCartQuantity } from '../../utils/cart';

type InvoiceScreenProps = {
  register: CashRegister;
};

export default function InvoiceScreen({ register }: InvoiceScreenProps) {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { count, subtotalCents, addQuantity, items } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [stockError, setStockError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const all = await productRepository.list();
    setProducts(all);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!stockError) return;
    const timer = setTimeout(() => setStockError(null), 3000);
    return () => clearTimeout(timer);
  }, [stockError]);

  const categories = ['Todos', ...Array.from(new Set(products.map((p) => p.category)))];

  const filtered = products
    .filter((product) => product.active)
    .filter((product) => {
      const matchesCategory = category === 'Todos' || product.category === category;
      const matchesQuery = product.name.toLowerCase().includes(query.trim().toLowerCase());
      return matchesCategory && matchesQuery;
    });

  const handleAdd = (product: Product) => {
    if (adding) return;
    const quantity = parseCartQuantity(quantities[product.id] ?? '1');
    setAdding(true);
    const inCart = inCartQuantity(items, product.id);
    if (inCart + quantity > product.stockQuantity) {
      setStockError(`Stock insuficiente para ${product.name}: quedan ${product.stockQuantity}.`);
      setAdding(false);
      return;
    }
    setStockError(null);
    addQuantity(product, quantity);
    setQuantities((current) => ({ ...current, [product.id]: '1' }));
    setAdding(false);
    Keyboard.dismiss();
  };

  const setQuantity = (id: string, text: string) => {
    setQuantities((current) => ({ ...current, [id]: text }));
    setStockError(null);
  };

  return (
    <Screen>
      <View style={styles.screenSurround}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          extraData={filtered}
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              quantity={quantities[item.id] ?? '1'}
              onChangeQuantity={(text) => setQuantity(item.id, text)}
              onAdd={() => handleAdd(item)}
            />
          )}
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

              {stockError ? (
                <View style={[styles.stockError, { backgroundColor: colors.danger + '1A', borderColor: colors.danger + '66' }]}>
                  <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  <Text style={[styles.stockErrorText, { color: colors.danger, fontSize: typography.sizes.caption }]}>
                    {stockError}
                  </Text>
                </View>
              ) : null}

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

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
                nestedScrollEnabled
              >
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

        <Pressable
          onPress={() => navigation.navigate('Cart')}
          style={({ pressed }) => [styles.cartBar, { backgroundColor: colors.surface, borderTopColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
        >
          <View style={styles.cartInfo}>
            <View>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
                {count === 0 ? 'Carrito vacío' : `${count} ${count === 1 ? 'producto' : 'productos'}`}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>Toca para ver el carrito</Text>
            </View>
            {count > 0 ? (
              <MoneyDisplay cents={subtotalCents} size="large" />
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>RD$0.00</Text>
            )}
          </View>
          <Ionicons name="chevron-up" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Screen>
  );
}

function ProductCard({
  product,
  quantity,
  onChangeQuantity,
  onAdd,
}: {
  product: Product;
  quantity: string;
  onChangeQuantity: (text: string) => void;
  onAdd: () => void;
}) {
  const { colors, spacing, typography, shadows } = useTheme();
  const outOfStock = product.stockQuantity <= 0;
  const lowStock = !outOfStock && product.stockQuantity <= 5;

  return (
    <View style={[styles.productCard, { backgroundColor: colors.surface, borderRadius: 16, boxShadow: shadows.card }]}>
      <ProductImage product={product} size={44} />
      <Text
        numberOfLines={2}
        style={[styles.productName, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }]}
      >
        {product.name}
      </Text>
      <Text style={[styles.productPrice, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>
        {formatMoney(product.priceCents)}
      </Text>
      <Text
        style={{
          color: outOfStock ? colors.danger : lowStock ? colors.warning : colors.textSecondary,
          fontSize: typography.sizes.caption,
          fontWeight: lowStock || outOfStock ? '700' : '400',
        }}
      >
        {outOfStock ? 'Agotado' : lowStock ? `¡Solo quedan ${product.stockQuantity}!` : `Quedan ${product.stockQuantity}`}
      </Text>

      <View style={styles.addRow}>
        <TextInput
          value={quantity}
          onChangeText={onChangeQuantity}
          keyboardType="number-pad"
          placeholder="1"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.quantityInput,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.textPrimary },
          ]}
        />
        <Pressable
          onPress={onAdd}
          disabled={outOfStock}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.primary, opacity: outOfStock ? 0.35 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={{ color: colors.textOnPrimary, fontSize: 20, fontWeight: '700', lineHeight: 22 }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenSurround: {
    flex: 1,
  },
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
    minHeight: 176,
  },
  productName: {
    flex: 1,
    marginTop: 8,
  },
  productPrice: {
    fontWeight: '600',
    marginTop: 6,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  quantityInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 15,
  },
  addButton: {
    width: 46,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  stockErrorText: {
    flex: 1,
    fontWeight: '600',
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