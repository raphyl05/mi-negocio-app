import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Column from '../../components/Column';
import PrimaryButton from '../../components/PrimaryButton';
import QuickEditModal from '../../components/QuickEditModal';
import Screen from '../../components/Screen';
import TextField from '../../components/TextField';
import type { ProductImageType } from '../../models/product';
import type { Provider } from '../../models/provider';
import type { RootStackParamList } from '../../navigation/types';
import { productRepository } from '../../repositories/productRepository';
import { stockMovementRepository } from '../../repositories/stockMovementRepository';
import { withTransaction } from '../../repositories/transaction';
import { deleteCachedPhoto } from '../../utils/productImages';
import { providerRepository } from '../../repositories/providerRepository';
import { useTheme } from '../../theme';
import { parseMoney, formatMoneyBlur } from '../../utils/money';
import { formatPhoneBlur, unformatPhoneFocus, sanitizeMoneyInput, sanitizeIntegerInput, sanitizePhoneInput } from '../../utils/inputFormat';
import { DEFAULT_PRODUCT_EMOJI, PRODUCT_ICON_CHOICES } from '../../utils/productImages';
import { validateProduct } from '../../utils/productValidation';
import type { ProductFormErrors } from '../../utils/productValidation';

type Route = RouteProp<RootStackParamList, 'ProductForm'>;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

function formatPriceEdit(cents: number): string {
  if (cents % 100 === 0) return String(cents / 100);
  if (cents % 10 === 0) return (cents / 100).toFixed(1);
  return (cents / 100).toFixed(2);
}

export default function ProductFormScreen() {
  const { colors, spacing, typography } = useTheme();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const productId = route.params?.productId;
  const editing = Boolean(productId);

  const [name, setName] = useState('');
  const [priceText, setPriceText] = useState('');
  const [category, setCategory] = useState('');
  const [provider, setProvider] = useState('');
  const [providerPhone, setProviderPhone] = useState('');
  const [active, setActive] = useState(true);
  const [stockText, setStockText] = useState('');
  const [imageType, setImageType] = useState<ProductImageType>('emoji');
  const [emoji, setEmoji] = useState('');
  const [icon, setIcon] = useState<string>(PRODUCT_ICON_CHOICES[0]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerFlash, setProviderFlash] = useState(false);

  useEffect(() => {
    productRepository.list().then((all) => {
      setCategories(Array.from(new Set(all.map((p) => p.category))));
    });
  }, []);

  useEffect(() => {
    providerRepository.list().then(setProviders);
  }, []);

  useEffect(() => {
    if (!productId) return;
    productRepository.getById(productId).then((product) => {
      if (!product) {
        navigation.goBack();
        return;
      }
      setName(product.name);
      setPriceText(formatPriceEdit(product.priceCents));
      setCategory(product.category);
      setProvider(product.provider ?? '');
      setProviderPhone(product.providerPhone ?? '');
      setActive(product.active);
      setStockText(String(product.stockQuantity));
      setImageType(product.imageType);
      setEmoji(product.emoji ?? '');
      setIcon(product.icon ?? PRODUCT_ICON_CHOICES[0]);
      setImageUri(product.imageUri ?? null);
    });
  }, [productId, navigation]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setErrors({});
    }
  };

  const handleSave = async () => {
    const validated = validateProduct({ name, priceText, category, stockText });
    setErrors(validated);
    if (Object.keys(validated).length > 0) return;

    const priceCents = parseMoney(priceText) ?? 0;
    const stockQuantity = Math.max(0, parseInt(stockText.trim(), 10) || 0);
    const image: { imageType: ProductImageType; emoji?: string; icon?: string; imageUri?: string } =
      imageType === 'emoji'
        ? { imageType: 'emoji', emoji: emoji.trim() || DEFAULT_PRODUCT_EMOJI }
        : imageType === 'icon'
          ? { imageType: 'icon', icon: icon || PRODUCT_ICON_CHOICES[0] }
          : { imageType: 'photo', imageUri: imageUri ?? undefined };

    setSaving(true);
    try {
      const cleanName = name.trim();
      const cleanCategory = category.trim().replace(/^\w/, (c) => c.toUpperCase());
      if (editing && productId) {
        const existing = await productRepository.getById(productId);
        if (!existing) {
          navigation.goBack();
          return;
        }
        await withTransaction(async () => {
          await productRepository.update({
            ...existing,
            ...image,
            name: cleanName,
            priceCents,
            category: cleanCategory,
            stockQuantity,
            active,
            provider: provider.trim() || undefined,
            providerPhone: providerPhone.trim() || undefined,
          });
          if (stockQuantity !== existing.stockQuantity) {
            await stockMovementRepository.recordMovement({
              productId: existing.id,
              quantity: stockQuantity - existing.stockQuantity,
              movementType: 'ADJUSTMENT',
            });
          }
        });
        if (existing.imageUri && existing.imageUri !== image.imageUri) {
          await deleteCachedPhoto(existing.imageUri);
        }
      } else {
        const created = await withTransaction(async () => {
          const created = await productRepository.create({
            id: '',
            name: cleanName,
            priceCents,
            category: cleanCategory,
            stockQuantity,
            active: true,
            createdAt: new Date().toISOString(),
            ...image,
            provider: provider.trim() || undefined,
            providerPhone: providerPhone.trim() || undefined,
          });
          if (created.stockQuantity > 0) {
            await stockMovementRepository.recordMovement({
              productId: created.id,
              quantity: created.stockQuantity,
              movementType: 'INITIAL_STOCK',
            });
          }
          return created;
        });
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!productId) return;
    Alert.alert('Eliminar producto', `¿Eliminar "${name}" del catálogo?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const existing = await productRepository.getById(productId);
          await productRepository.remove(productId);
          if (existing?.imageUri) await deleteCachedPhoto(existing.imageUri);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleCategoryLongPress = (c: string) => {
    Alert.alert('Categoría', `¿Qué quieres hacer con "${c}"?`, [
      { text: 'Renombrar', onPress: () => setRenamingCategory(c) },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Eliminar categoría', `¿Eliminar "${c}" y todos sus productos?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Eliminar',
              style: 'destructive',
              onPress: async () => {
                await productRepository.removeByCategory(c);
                setCategories((prev) => prev.filter((cat) => cat !== c));
                if (category === c) setCategory('');
              },
            },
          ]);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleRenameCategory = async (newName: string) => {
    if (!renamingCategory) return;
    const cleanName = newName.trim().replace(/^\w/, (ch) => ch.toUpperCase());
    if (cleanName && cleanName !== renamingCategory) {
      await productRepository.renameCategory(renamingCategory, cleanName);
      setCategories((prev) => prev.map((cat) => (cat === renamingCategory ? cleanName : cat)));
      if (category === renamingCategory) setCategory(cleanName);
    }
    setRenamingCategory(null);
  };

  const providerSuggestions = useMemo(() => {
    const name = provider.trim().toLowerCase();
    const phone = providerPhone.trim().toLowerCase();
    if (!name && !phone) return [];
    return providers
      .filter(
        (item) =>
          (name && item.name.toLowerCase().includes(name)) ||
          (phone && item.phone.toLowerCase().includes(phone)),
      )
      .slice(0, 5);
  }, [providers, provider, providerPhone]);

  const useProvider = (saved: Provider) => {
    setProvider(saved.name);
    setProviderPhone(saved.phone);
  };

  const canSaveProvider = provider.trim().length > 0;

  const handleSaveProvider = async () => {
    if (!canSaveProvider) return;
    await providerRepository.create({
      name: provider.trim(),
      phone: providerPhone,
      address: '',
      note: '',
      createdAt: new Date().toISOString(),
    });
    setProviders(await providerRepository.list());
    setProviderFlash(true);
    setTimeout(() => setProviderFlash(false), 2500);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Column>
          <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={[styles.backButton, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text
            style={[
              styles.title,
              { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
            ]}
          >
            {editing ? 'Editar producto' : 'Nuevo producto'}
          </Text>
        </View>

        <View style={styles.section}>
          <TextField label="Nombre" value={name} onChangeText={setName} error={errors.name} placeholder="Ej. Hamburguesa" />
          <TextField
            label="Precio (RD$)"
            value={priceText}
            onChangeText={setPriceText}
            error={errors.price}
            keyboardType="decimal-pad"
            placeholder="Ej. 250 o 250.50"
            formatOnBlur={formatMoneyBlur}
            sanitize={sanitizeMoneyInput}
            selectTextOnFocus
          />
          <View style={styles.fieldGroup}>
            <TextField label="Categoría" value={category} onChangeText={setCategory} error={errors.category} placeholder="Ej. Comidas" />
            {categories.length > 0 ? (
              <>
                <View style={styles.categoryChips}>
                  {categories.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setCategory(c)}
                      onLongPress={() => handleCategoryLongPress(c)}
                      delayLongPress={350}
                      style={[
                        styles.categoryChip,
                        { backgroundColor: category === c ? colors.primaryLight : colors.surfaceMuted },
                      ]}
                    >
                      <Text
                        style={{ color: category === c ? colors.primary : colors.textSecondary, fontSize: typography.sizes.caption, fontWeight: '600' }}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
                  Mantén presionada una categoría para renombrarla o eliminarla.
                </Text>
              </>
            ) : null}
          </View>
        </View>

        <View
          style={[
            styles.section,
            { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, gap: 10 },
          ]}
        >
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
            PROVEEDOR (OPCIONAL)
          </Text>
          <TextField
            label="Proveedor"
            value={provider}
            onChangeText={setProvider}
            placeholder="Nombre del proveedor"
            autoCapitalize="words"
          />
          {providerSuggestions.length > 0 ? (
            <View style={[styles.providerSuggestions, { borderColor: colors.border }]}>
              {providerSuggestions.map((saved) => (
                <Pressable
                  key={saved.id}
                  onPress={() => useProvider(saved)}
                  style={({ pressed }) => [
                    styles.providerSuggestionRow,
                    { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <View style={styles.providerSuggestionText}>
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
            label="Teléfono del proveedor"
            value={providerPhone}
            onChangeText={setProviderPhone}
            keyboardType="phone-pad"
            placeholder="809-000-0000"
            formatOnFocus={unformatPhoneFocus}
            formatOnBlur={formatPhoneBlur}
            sanitize={sanitizePhoneInput}
          />
          <Pressable
            onPress={handleSaveProvider}
            disabled={!canSaveProvider}
            style={({ pressed }) => [
              styles.providerSaveRow,
              {
                backgroundColor: providerFlash ? colors.success + '1A' : colors.surfaceMuted,
                opacity: !canSaveProvider || pressed ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons
              name={providerFlash ? 'checkmark-circle' : 'bookmark-outline'}
              size={18}
              color={providerFlash ? colors.success : colors.primary}
            />
            <Text
              style={{
                color: providerFlash ? colors.success : colors.primary,
                fontSize: typography.sizes.body,
                fontWeight: '700',
              }}
            >
              {providerFlash ? 'Proveedor guardado' : 'Guardar proveedor'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }]}>
            Imagen del producto
          </Text>
          <View style={styles.segmentRow}>
            {(
              [
                { key: 'emoji', label: 'Emoji' },
                { key: 'icon', label: 'Ícono' },
                { key: 'photo', label: 'Foto' },
              ] as const
            ).map((option) => {
              const active = imageType === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setImageType(option.key)}
                  style={[
                    styles.segmentOption,
                    {
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? colors.textOnPrimary : colors.textPrimary, fontWeight: '600' }}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {imageType === 'emoji' ? (
            <TextField label="Emoji" value={emoji} onChangeText={setEmoji} placeholder="Ej. 🍔 (deja vacío para uno por defecto)" />
          ) : null}

          {imageType === 'icon' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
              {PRODUCT_ICON_CHOICES.map((name) => {
                const selected = icon === name;
                return (
                  <Pressable
                    key={name}
                    onPress={() => setIcon(name)}
                    style={[
                      styles.iconOption,
                      {
                        backgroundColor: selected ? colors.primaryLight : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Ionicons name={name as ComponentProps<typeof Ionicons>['name']} size={24} color={selected ? colors.primary : colors.textPrimary} />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {imageType === 'photo' ? (
            <View style={styles.photoPanel}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={[styles.photoPreview, { backgroundColor: colors.surfaceMuted }]} />
              ) : null}
              <PrimaryButton label={imageUri ? 'Cambiar foto' : 'Elegir foto de galería'} onPress={pickPhoto} variant="outline" />
              {imageUri ? (
                <Pressable onPress={() => setImageUri(null)} hitSlop={8}>
                  <Text style={{ color: colors.danger, fontSize: typography.sizes.caption, fontWeight: '600' }}>Quitar foto</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }]}>
            Stock
          </Text>
          <TextField
            label="Cantidad en stock"
            value={stockText}
            onChangeText={setStockText}
            error={errors.stock}
            keyboardType="number-pad"
            placeholder="Ej. 50"
            sanitize={sanitizeIntegerInput}
          />

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={{ color: colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }}>
                Producto activo
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.caption }}>
                Los inactivos no aparecen en la facturación
              </Text>
            </View>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={active ? colors.primary : colors.surfaceMuted}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label={editing ? 'Guardar cambios' : 'Crear producto'}
            onPress={handleSave}
            loading={saving}
          />
          {editing ? (
            <Pressable onPress={handleDelete} hitSlop={8} style={styles.deleteLink}>
              <Text style={{ color: colors.danger, fontSize: typography.sizes.body, fontWeight: '600' }}>Eliminar producto</Text>
            </Pressable>
          ) : null}
        </View>
        </Column>
      </ScrollView>

      <QuickEditModal
        visible={renamingCategory !== null}
        mode="text"
        productName="Categoría"
        currentValue={renamingCategory ?? ''}
        onSubmit={(value) => handleRenameCategory(value)}
        onClose={() => setRenamingCategory(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    letterSpacing: -0.5,
  },
  section: {
    gap: 12,
    marginBottom: 20,
  },
  sectionLabel: {
    marginLeft: 4,
  },
  providerSuggestions: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 6,
    gap: 6,
  },
  providerSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  providerSuggestionText: {
    flex: 1,
    gap: 2,
  },
  providerSaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 12,
  },
  fieldGroup: {
    gap: 10,
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRow: {
    gap: 10,
    paddingVertical: 2,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPanel: {
    alignItems: 'flex-start',
    gap: 12,
  },
  photoPreview: {
    width: 84,
    height: 84,
    borderRadius: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleInfo: {
    flex: 1,
    gap: 2,
  },
  actions: {
    gap: 12,
  },
  deleteLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});