jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveOfflineSession,
  loadOfflineSession,
  clearOfflineSession,
  sessionFromSnapshot,
} from '../src/utils/sessionStore';

const SESSION_SNAPSHOT_KEY = 'vendelo.offlineSession';

describe('sessionStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('guarda y recupera una sesión offline', async () => {
    await saveOfflineSession({ user: { id: 'u1', username: 'ana', createdAt: '2026-09-22T00:00:00.000Z' }, offline: true });
    const snapshot = await loadOfflineSession();
    expect(snapshot).toEqual({
      user: { id: 'u1', username: 'ana', createdAt: '2026-09-22T00:00:00.000Z' },
      offline: true,
    });
  });

  it('guarda y recupera también el snapshot de sesiones online (para caer a offline si toca)', async () => {
    await saveOfflineSession({ user: { id: 'u2', username: 'beto', createdAt: '2026-09-22T00:00:00.000Z' }, offline: false });
    const snapshot = await loadOfflineSession();
    expect(snapshot?.offline).toBe(false);
  });

  it('convierte un snapshot en sesión offline sin tokens', async () => {
    const session = sessionFromSnapshot({ user: { id: 'u1', username: 'ana', createdAt: 'x' }, offline: true });
    expect(session).toEqual({
      user: { id: 'u1', username: 'ana', createdAt: 'x' },
      accessToken: '',
      refreshToken: '',
      expiresIn: 0,
      businesses: [],
      offline: true,
    });
  });

  it('sin snapshot guardado devuelve null', async () => {
    expect(await loadOfflineSession()).toBeNull();
  });

  it('rechaza JSON corrupto', async () => {
    await AsyncStorage.setItem(SESSION_SNAPSHOT_KEY, '{no-es-json');
    expect(await loadOfflineSession()).toBeNull();
  });

  it('rechaza snapshots sin usuario', async () => {
    await AsyncStorage.setItem(SESSION_SNAPSHOT_KEY, JSON.stringify({ user: null, offline: true }));
    expect(await loadOfflineSession()).toBeNull();
  });

  it('clearOfflineSession elimina el snapshot', async () => {
    await saveOfflineSession({ user: { id: 'u1', username: 'ana', createdAt: 'x' }, offline: true });
    await clearOfflineSession();
    expect(await loadOfflineSession()).toBeNull();
  });
});