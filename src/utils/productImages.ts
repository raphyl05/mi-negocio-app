import { Platform } from 'react-native';

export const DEFAULT_PRODUCT_EMOJI = '🍽️';

export const PRODUCT_ICON_CHOICES = [
  'fast-food',
  'restaurant',
  'pizza',
  'cafe',
  'ice-cream',
  'wine',
  'beer',
  'water',
  'basket',
  'pricetag',
  'nutrition',
  'egg',
  'fish',
  'leaf',
  'bonfire',
  'fast-food-outline',
  'restaurant-outline',
  'pizza-outline',
  'cafe-outline',
  'ice-cream-outline',
  'wine-outline',
  'beer-outline',
  'basket-outline',
  'pricetag-outline',
  'nutrition-outline',
  'egg-outline',
  'fish-outline',
  'leaf-outline',
] as const;

export async function getPhotoCacheDirectory(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { cacheDirectory } = require('expo-file-system/legacy');
    return cacheDirectory ?? null;
  } catch {
    return null;
  }
}

export function isCachedPhotoUri(uri: string | null | undefined, cacheDir: string | null | undefined): boolean {
  return Boolean(uri && cacheDir && uri.startsWith(cacheDir));
}

export async function deleteCachedPhoto(uri: string | null | undefined): Promise<void> {
  const cacheDir = await getPhotoCacheDirectory();
  if (!isCachedPhotoUri(uri, cacheDir)) return;
  try {
    const { deleteAsync } = require('expo-file-system/legacy');
    await deleteAsync(uri, { idempotent: true });
  } catch {
    // Mejor esfuerzo: una foto huérfana en caché no debe romper la operación.
  }
}