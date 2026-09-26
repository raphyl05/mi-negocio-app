import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const SECURE_USER_KEY = 'vendelo.user';
export const LEGACY_USER_KEY = '@vendelo/user';

function useSecureStore(): boolean {
  return Platform.OS !== 'web';
}

export async function readSecureUser(): Promise<string | null> {
  if (!useSecureStore()) {
    return AsyncStorage.getItem(LEGACY_USER_KEY);
  }
  try {
    const { getItemAsync } = require('expo-secure-store');
    const secure = await getItemAsync(SECURE_USER_KEY);
    if (secure) return secure;
  } catch {
    // SecureStore no disponible: se cae al legado de AsyncStorage.
  }
  const legacy = await AsyncStorage.getItem(LEGACY_USER_KEY);
  if (legacy) {
    try {
      const { setItemAsync } = require('expo-secure-store');
      await setItemAsync(SECURE_USER_KEY, legacy);
    } catch {
      // Mejor esfuerzo: si no, queda en AsyncStorage como estaba.
    }
    await AsyncStorage.removeItem(LEGACY_USER_KEY);
    return legacy;
  }
  return null;
}

export async function writeSecureUser(value: string): Promise<void> {
  if (!useSecureStore()) {
    await AsyncStorage.setItem(LEGACY_USER_KEY, value);
    return;
  }
  try {
    const { setItemAsync } = require('expo-secure-store');
    await setItemAsync(SECURE_USER_KEY, value);
    await AsyncStorage.removeItem(LEGACY_USER_KEY);
  } catch {
    await AsyncStorage.setItem(LEGACY_USER_KEY, value);
  }
}

export async function removeSecureUser(): Promise<void> {
  if (!useSecureStore()) {
    await AsyncStorage.removeItem(LEGACY_USER_KEY);
    return;
  }
  try {
    const { deleteItemAsync } = require('expo-secure-store');
    await deleteItemAsync(SECURE_USER_KEY);
  } catch {
    // No hay nada que borrar o el almacén no está disponible.
  }
  await AsyncStorage.removeItem(LEGACY_USER_KEY);
}