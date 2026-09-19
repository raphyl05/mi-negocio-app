import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import MoneyDisplay from '../../components/MoneyDisplay';
import PrimaryButton from '../../components/PrimaryButton';
import ProductImage from '../../components/ProductImage';
import Screen from '../../components/Screen';
import TextField from '../../components/TextField';
import { useCart } from '../../contexts/CartContext';
import type { Customer } from '../../models/customer';
import type { RootStackParamList } from '../../navigation/types';
import { customerRepository } from '../../repositories/customerRepository';
import { useTheme } from '../../theme';
import { formatMoney } from '../../utils/money';
import { formatPhoneBlur, unformatPhoneFocus } from '../../utils/inputFormat';
import type { CartItem } from '../../utils/cart';

export default function CartScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, subtotalCents, customer, updateQuantity, setCustomerField } = useCart();
  const [showCustomer, setShowCustomer] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');

  useEffect(() => {
    let active = true;
    customerRepository.list().then((list) => {
      if (active) setSavedCustomers(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return savedCustomers;
    return savedCustomers.filter(
      (item) => item.name.toLowerCase().includes(q) || item.phone.includes(q),
    );
  }, [savedCustomers, customerQuery]);

  const useSavedCustomer = (saved: Customer) => {
    setCustomerField('customerName', saved.name);
    setCustomerField('phone', saved.phone);
    setCustomerField('address', saved.address);
    setCustomerField('description', saved.note);
    setCustomerQuery('');
    setShowSaved(false);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
          ]}
        >
          Carrito
        </Text>
        <Pressable onPress={() => navigation.goBack()} style={[styles.closeButton, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      {items.length === 0 ? (
        <EmptyState icon="cart-outline" title="Carrito vacío" subtitle="Agrega productos desde la facturación." />
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.product.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <CartRow item={item} />}
          />

          <View style={styles.footer}>
            <Pressable onPress={() => setShowCustomer((prev) => !prev)} style={styles.customerToggle}>
              <Ionicons name={showCustomer ? 'chevron-down' : 'chevron-up'} size={18} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
                Datos del cliente (opcional)
              </Text>
            </Pressable>

            {showCustomer ? (
              <View style={styles.customerPanel}>
                <View style={[styles.savedBox, { borderColor: colors.border }]}>
                  <Pressable
                    onPress={() => setShowSaved((prev) => !prev)}
                    style={styles.customerToggle}
                  >
                    <Ionicons name={showSaved ? 'chevron-down' : 'chevron-up'} size={18} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
                      Usar cliente guardado
                    </Text>
                  </Pressable>
                  {showSaved ? (
                    <View style={styles.savedSearch}>
                      <TextInput
                        value={customerQuery}
                        onChangeText={setCustomerQuery}
                        placeholder="Buscar por nombre o teléfono…"
                        placeholderTextColor={colors.textSecondary}
                        returnKeyType="done"
                        onSubmitEditing={() => Keyboard.dismiss()}
                        blurOnSubmit
                        style={[
                          styles.searchBox,
                          {
                            backgroundColor: colors.surfaceMuted,
                            borderColor: colors.border,
                            color: colors.textPrimary,
                          },
                        ]}
                      />
                      {savedCustomers.length === 0 ? (
                        <Text style={styles.searchHint}>
                          No hay clientes guardados. Agrégalos en Más → Clientes.
                        </Text>
                      ) : filteredCustomers.length === 0 ? (
                        <Text style={styles.searchHint}>Sin resultados para «{customerQuery}».</Text>
                      ) : (
                        filteredCustomers.slice(0, 5).map((saved) => (
                          <Pressable
                            key={saved.id}
                            onPress={() => useSavedCustomer(saved)}
                            style={({ pressed }) => [
                              styles.savedRow,
                              { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.75 : 1 },
                            ]}
                          >
                            <View style={styles.savedRowText}>
                              <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '600' }}>
                                {saved.name}
                              </Text>
                              {saved.phone ? (
                                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
                                  {saved.phone}
                                </Text>
                              ) : null}
                            </View>
                            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                          </Pressable>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
                <TextField
                  label="Nombre y apellido"
                  value={customer.customerName}
                  onChangeText={(text) => setCustomerField('customerName', text)}
                  autoCapitalize="words"
                  placeholder="Ej. Juan Pérez"
                />
                <TextField
                  label="Teléfono"
                  value={customer.phone}
                  onChangeText={(text) => setCustomerField('phone', text)}
                  keyboardType="phone-pad"
                  placeholder="809-000-0000"
                  formatOnFocus={unformatPhoneFocus}
                  formatOnBlur={formatPhoneBlur}
                />
                <TextField
                  label="Dirección"
                  value={customer.address}
                  onChangeText={(text) => setCustomerField('address', text)}
                  placeholder="Dirección de entrega"
                />
                <TextField
                  label="Descripción"
                  value={customer.description}
                  onChangeText={(text) => setCustomerField('description', text)}
                  multiline
                  placeholder="Notas, aclaraciones…"
                />
              </View>
            ) : null}

            <View style={styles.subtotalRow}>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>Subtotal</Text>
              <MoneyDisplay cents={subtotalCents} size="large" />
            </View>

            <PrimaryButton label="Continuar" onPress={() => navigation.navigate('Payment')} />
            <Text style={[styles.footerNote, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
              Al continuar podrás cobrar o guardar la orden
            </Text>
          </View>
        </>
      )}
    </Screen>
  );
}

function CartRow({ item }: { item: CartItem }) {
  const { colors, spacing, typography } = useTheme();
  const { increase, decrease, remove, updateQuantity } = useCart();
  const { product, quantity } = item;
  const lineTotal = product.priceCents * quantity;

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderRadius: 16 }]}>
      <ProductImage product={product} size={40} />

      <View style={styles.rowInfo}>
        <Text
          numberOfLines={1}
          style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }}
        >
          {product.name}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
          {formatMoney(product.priceCents)}
        </Text>
      </View>

      <View style={styles.rowRight}>
        <View style={[styles.stepper, { borderColor: colors.border }]}>
          <Pressable onPress={() => decrease(product.id)} style={[styles.stepButton, { backgroundColor: colors.surfaceMuted }]} hitSlop={4}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>−</Text>
          </Pressable>
          <TextInput
            value={String(quantity)}
            onChangeText={(text) => updateQuantity(product.id, text)}
            onBlur={() => Keyboard.dismiss()}
            keyboardType="number-pad"
            style={[styles.stepCount, { color: colors.textPrimary, backgroundColor: 'transparent' }]}
            textAlign="center"
          />
          <Pressable onPress={() => increase(product.id)} style={[styles.stepButton, { backgroundColor: colors.primary }]} hitSlop={4}>
            <Text style={{ color: colors.textOnPrimary, fontSize: 18, fontWeight: '700' }}>+</Text>
          </Pressable>
        </View>
        <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: '700' }}>
          {formatMoney(lineTotal)}
        </Text>
      </View>

      <Pressable onPress={() => remove(product.id)} style={styles.deleteButton} hitSlop={8}>
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    marginBottom: 12,
  },
  title: {
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 24,
    gap: 12,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowInfo: {
    flex: 1,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 4,
  },
  stepButton: {
    width: 42,
    height: 36,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCount: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    marginLeft: 6,
    alignSelf: 'flex-start',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  customerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerPanel: {
    gap: 12,
  },
  savedBox: {
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  savedSearch: {
    gap: 8,
  },
  searchBox: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  searchHint: {
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: 4,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  savedRowText: {
    flex: 1,
    gap: 2,
  },
  subtotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  footerNote: {
    textAlign: 'center',
  },
});