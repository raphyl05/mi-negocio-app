jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/utils/password', () => ({
  generateId: () => `id-${Math.random().toString(36).slice(2)}`,
  generateSalt: () => 'mock-salt',
  hashPassword: (value: string, salt: string) => `${salt}:${value}`,
  verifyPassword: async (password: string, salt: string, storedHash: string) => storedHash === `${salt}:${password}`,
  isPbkdf2Hash: () => false,
  isLegacySha256Hash: () => true,
}));

jest.mock('../src/utils/secureStore', () => {
  const mockStore = jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock');
  return {
    SECURE_USER_KEY: 'vendelo.user',
    LEGACY_USER_KEY: '@micaja/user',
    readSecureUser: async () => mockStore.getItem('@micaja/user'),
    writeSecureUser: async (value: string) => mockStore.setItem('@micaja/user', value),
    removeSecureUser: async () => mockStore.removeItem('@micaja/user'),
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getUser,
  hasSecurityQuestion,
  normalizeSecurityAnswer,
  saveSecurityQuestion,
  saveSetup,
  setNewPassword,
  updateUser,
  verifyLogin,
  verifySecurityAnswer,
} from '../src/services/setupService';

beforeEach(async () => {
  await AsyncStorage.clear();
  await saveSetup({
    name: 'Mi Negocio',
    username: 'vendedor',
    password: 'clave1234',
  });
});

describe('recuperación de contraseña por pregunta de seguridad', () => {
  it('inicialmente no hay pregunta de seguridad', async () => {
    expect(await hasSecurityQuestion()).toBe(false);
  });

  it('normaliza la respuesta: espacio, mayúsculas y acentos', () => {
    expect(normalizeSecurityAnswer('  LUNA ')).toBe('luna');
    expect(normalizeSecurityAnswer('  áéíóú ').charCodeAt(0)).toBe(0xe1);
  });

  it('guarda la pregunta y verifica la misma respuesta sin importar mayúsculas', async () => {
    await saveSecurityQuestion('¿Nombre de tu primera mascota?', 'Luna');

    expect(await hasSecurityQuestion()).toBe(true);
    expect(await verifySecurityAnswer('vendedor', 'LUNA')).toBe(true);
    expect(await verifySecurityAnswer('vendedor', 'luna')).toBe(true);
  });

  it('rechaza respuestas incorrectas y usuarios equivocados', async () => {
    await saveSecurityQuestion('¿Nombre de tu primera mascota?', 'luna');

    expect(await verifySecurityAnswer('vendedor', 'rex')).toBe(false);
    expect(await verifySecurityAnswer('otro', 'luna')).toBe(false);
  });

  it('rechaza verificación si nunca se configuró la pregunta', async () => {
    expect(await verifySecurityAnswer('vendedor', 'luna')).toBe(false);
  });

  it('cambia la contraseña y permite iniciar sesión con la nueva', async () => {
    await saveSecurityQuestion('¿Nombre de tu primera mascota?', 'luna');
    await setNewPassword('vendedor', 'nuevaClave99');

    expect(await verifyLogin('vendedor', 'nuevaClave99')).not.toBeNull();
    expect(await verifyLogin('vendedor', 'clave1234')).toBeNull();
  });

  it('no cambia la contraseña de un usuario inexistente', async () => {
    expect(await setNewPassword('fantasma', 'nuevaClave99')).toBe(false);
    expect(await verifyLogin('vendedor', 'clave1234')).not.toBeNull();
  });
});

describe('usuario restaurado sin credenciales', () => {
  it('no puede iniciar sesión si el respaldo no trajo hash ni sal', async () => {
    const user = await getUser();
    if (user) {
      await updateUser({ ...user, passwordHash: '', passwordSalt: '' });
    }
    expect(await verifyLogin('vendedor', 'clave1234')).toBeNull();
    expect(await verifyLogin('vendedor', '')).toBeNull();
  });

  it('puede crear una contraseña nueva aunque el respaldo no trajera hash', async () => {
    const user = await getUser();
    if (user) {
      await updateUser({ ...user, passwordHash: '', passwordSalt: '' });
    }
    expect(await setNewPassword('vendedor', 'nueva99')).toBe(true);
    expect(await verifyLogin('vendedor', 'nueva99')).not.toBeNull();
  });
});

describe('sesión', () => {
  it('la sesión devuelta por login no expone el hash ni la sal', async () => {
    await saveSecurityQuestion('¿Nombre de tu primera mascota?', 'Luna');
    const session = await verifyLogin('vendedor', 'clave1234');
    expect(session).not.toBeNull();
    if (session) {
      expect(session).toEqual({ id: expect.any(String), username: 'vendedor', createdAt: expect.any(String) });
      expect((session as Partial<typeof session> & Record<string, unknown>).passwordHash).toBeUndefined();
    }
  });
});