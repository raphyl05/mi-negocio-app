jest.mock('expo-secure-store', () => {
  const map = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => map.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      map.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      map.delete(key);
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LEGACY_USER_KEY,
  readSecureUser,
  removeSecureUser,
  SECURE_USER_KEY,
  writeSecureUser,
} from '../src/utils/secureStore';

beforeEach(async () => {
  await AsyncStorage.clear();
  await removeSecureUser();
});

describe('secureStore', () => {
  it('leer sin datos devuelve null', async () => {
    expect(await readSecureUser()).toBeNull();
  });

  it('escribe en SecureStore y limpia el legado de AsyncStorage', async () => {
    await AsyncStorage.setItem(LEGACY_USER_KEY, 'legacy');
    await writeSecureUser('nuevo');
    expect(await AsyncStorage.getItem(LEGACY_USER_KEY)).toBeNull();
    expect(await readSecureUser()).toBe('nuevo');
  });

  it('migra automáticamente un usuario legado de AsyncStorage a SecureStore', async () => {
    await AsyncStorage.setItem(LEGACY_USER_KEY, '{"usuario":"viejo"}');
    expect(await readSecureUser()).toBe('{"usuario":"viejo"}');
    expect(await AsyncStorage.getItem(LEGACY_USER_KEY)).toBeNull();
    expect(await readSecureUser()).toBe('{"usuario":"viejo"}');
  });

  it('prefiere el dato de SecureStore sobre el legado', async () => {
    await AsyncStorage.setItem(LEGACY_USER_KEY, 'legacy');
    await writeSecureUser('seguro');
    expect(await readSecureUser()).toBe('seguro');
  });

  it('elimina el usuario seguro y el legado', async () => {
    await writeSecureUser('seguro');
    await AsyncStorage.setItem(LEGACY_USER_KEY, 'restos');
    await removeSecureUser();
    expect(await readSecureUser()).toBeNull();
    expect(await AsyncStorage.getItem(LEGACY_USER_KEY)).toBeNull();
    await removeSecureUser();
  });
});

describe('secureStore contraseñas', () => {
  it('el hash de contraseña viaja por el almacén seguro, no por AsyncStorage', async () => {
    await writeSecureUser(JSON.stringify({ passwordHash: 'pbkdf2$...', passwordSalt: 'sal' }));
    const rawLegacy = await AsyncStorage.getItem(LEGACY_USER_KEY);
    expect(rawLegacy).toBeNull();
    expect(await readSecureUser()).toContain('pbkdf2$');
  });
});