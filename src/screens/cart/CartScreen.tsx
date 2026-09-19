import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { formatPhoneBlur, unformatPhoneFocus, sanitizePhoneInput } from '../../utils/inputFormat';
import type { CartItem } from '../../utils/cart';

export default function CartScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { items, subtotalCents, customer, updateQuantity, setCustomerField } = useCart();
  const [showCustomer, setShowCustomer] = useState(false);
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let active = true;
    customerRepository.list().then((list) => {
      if (active) setSavedCustomers(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const filteredSuggestions = useMemo(() => {
    const name = customer.customerName.trim().toLowerCase();
    const phone = customer.phone.trim().toLowerCase();
    if (!name && !phone) return [];
    return savedCustomers
      .filter(
        (item) =>
          (name && item.name.toLowerCase().includes(name)) ||
          (phone && item.phone.toLowerCase().includes(phone)),
      )
      .slice(0, 5);
  }, [savedCustomers, customer.customerName, customer.phone]);

  const useSavedCustomer = (saved: Customer) => {
    setCustomerField('customerName', saved.name);
    setCustomerField('phone', saved.phone);
    setCustomerField('address', saved.address);
    setCustomerField('description', saved.note);
  };

  const canSaveCustomer = customer.customerName.trim().length > 0;

  const handleSaveCustomer = async () => {
    if (!canSaveCustomer) return;
    await customerRepository.create({
      name: customer.customerName.trim(),
      phone: customer.phone,
      address: customer.address,
      note: customer.description,
      createdAt: new Date().toISOString(),
    });
    setSavedCustomers(await customerRepository.list());
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
            style={styles.flex}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => <CartRow item={item} />}
          />

          <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <Pressable onPress={() => setShowCustomer((prev) => !prev)} style={styles.customerToggle}>
              <Ionicons name={showCustomer ? 'chevron-down' : 'chevron-up'} size={18} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
                Datos del cliente (opcional)
              </Text>
            </Pressable>

            {showCustomer ? (
              <View style={styles.customerPanelWrap}>
                <ScrollView
                  style={styles.customerScroll}
                  contentContainerStyle={styles.customerPanel}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  showsVerticalScrollIndicator={false}
                >
                  <TextField
                    label="Nombre y apellido"
                    value={customer.customerName}
                    onChangeText={(text) => setCustomerField('customerName', text)}
                    autoCapitalize="words"
                    placeholder="Ej. Juan Pérez"
                  />
                  {filteredSuggestions.length > 0 ? (
                    <View style={[styles.suggestions, { borderColor: colors.border }]}>
                      {filteredSuggestions.map((saved) => (
                        <Pressable
                          key={saved.id}
                          onPress={() => useSavedCustomer(saved)}
                          style={({ pressed }) => [
                            styles.suggestionRow,
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
                          <Ionicons name="download-outline" size={18} color={colors.primary} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  <TextField
                    label="Teléfono"
                    value={customer.phone}
                    onChangeText={(text) => setCustomerField('phone', text)}
                    keyboardType="phone-pad"
                    placeholder="809-000-0000"
                    formatOnFocus={unformatPhoneFocus}
                    formatOnBlur={formatPhoneBlur}
                    sanitize={sanitizePhoneInput}
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
                  <Pressable
                    onPress={handleSaveCustomer}
                    disabled={!canSaveCustomer}
                    style={({ pressed }) => [
                      styles.saveRow,
                      {
                        backgroundColor: savedFlash ? colors.success + '1A' : colors.surfaceMuted,
                        opacity: !canSaveCustomer || pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={savedFlash ? 'checkmark-circle' : 'bookmark-outline'}
                      size={18}
                      color={savedFlash ? colors.success : colors.primary}
                    />
                    <Text
                      style={{
                        color: savedFlash ? colors.success : colors.primary,
                        fontSize: typography.sizes.body,
                        fontWeight: '700',
                      }}
                    >
                      {savedFlash ? 'Cliente guardado' : 'Guardar cliente'}
                    </Text>
                  </Pressable>
                </ScrollView>
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
      </KeyboardAvoidingView>
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
            onChangeText={(text) => updateQuantity(product.id, text.replace(/\D/g, ''))}
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
  flex: {
    flex: 1,
  },
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
    borderTopWidth: 1,
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
  customerPanelWrap: {
    maxHeight: 300,
  },
  customerScroll: {
    flexGrow: 0,
  },
  customerPanel: {
    gap: 12,
    paddingBottom: 4,
  },
  suggestions: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 6,
    gap: 6,
  },
  suggestionRow: {
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
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 14,
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