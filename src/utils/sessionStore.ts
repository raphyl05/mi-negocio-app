import AsyncStorage from '@react-native-async-storage/async-storage';

export type OfflineSessionSnapshot = {
  user: { id: string; username: string; createdAt: string };
  offline: boolean;
};

const SESSION_SNAPSHOT_KEY = 'micaja.offlineSession';

export async function saveOfflineSession(snapshot: OfflineSessionSnapshot): Promise<void> {
  await AsyncStorage.setItem(SESSION_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export async function loadOfflineSession(): Promise<OfflineSessionSnapshot | null> {
  const raw = await AsyncStorage.getItem(SESSION_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OfflineSessionSnapshot>;
    if (!parsed || !parsed.user || !parsed.user.id) return null;
    return parsed as OfflineSessionSnapshot;
  } catch {
    return null;
  }
}

export async function clearOfflineSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_SNAPSHOT_KEY);
}

// Autentica un snapshot guardado contra un usuario local. Devuelve la sesión
// sin tokens correspondiente, para reabrir la app sin pedir login de nuevo.
export function sessionFromSnapshot(
  snapshot: OfflineSessionSnapshot,
): { user: { id: string; username: string; createdAt: string }; accessToken: string; refreshToken: string; expiresIn: number; businesses: never[]; offline: true } {
  return {
    user: snapshot.user,
    accessToken: '',
    refreshToken: '',
    expiresIn: 0,
    businesses: [],
    offline: true,
  };
}