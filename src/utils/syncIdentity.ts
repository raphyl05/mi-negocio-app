import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId } from './password';

export const DEVICE_ID_KEY = '@vendelo/deviceId';

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    cachedDeviceId = existing;
    return existing;
  }
  const next = generateId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  cachedDeviceId = next;
  return next;
}

export function resetDeviceIdCache(): void {
  cachedDeviceId = null;
}