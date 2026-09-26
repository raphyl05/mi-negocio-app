/**
 * Migración de almacenamiento por el renombre de la app (MiCaja -> Vendelo App).
 *
 * Las claves de persistencia y el nombre de la base de datos llevan el nombre de
 * la marca. Renombrarlas dejaria huerfanos los datos de las instalaciones ya
 * existentes, asi que al arrancar se copian las claves viejas a las nuevas una
 * sola vez y se borran las antiguas.
 */

export const MIGRATION_FLAG_KEY = '@vendelo/legacyStorageMigrated';
export const LEGACY_DATABASE_NAME = 'micaja.db';
export const DATABASE_NAME = 'vendelo.db';

/** Claves de AsyncStorage: [legada, nueva]. */
export const ASYNC_STORAGE_KEY_MIGRATIONS: ReadonlyArray<readonly [string, string]> = [
  ['@micaja/business', '@vendelo/business'],
  ['@micaja/cashRegister', '@vendelo/cashRegister'],
  ['@micaja/cashClosures', '@vendelo/cashClosures'],
  ['@micaja/printer', '@vendelo/printer'],
  ['@micaja/driveToken', '@vendelo/driveToken'],
  ['@micaja/pendingSync', '@vendelo/pendingSync'],
  ['@micaja/syncChanges', '@vendelo/syncChanges'],
  ['@micaja/syncRequestKeys', '@vendelo/syncRequestKeys'],
  ['@micaja/deviceId', '@vendelo/deviceId'],
  ['@micaja/theme', '@vendelo/theme'],
  ['@micaja/lastVacuumAt', '@vendelo/lastVacuumAt'],
  ['@micaja/user', '@vendelo/user'],
  ['micaja.offlineSession', 'vendelo.offlineSession'],
];

/** Claves de SecureStore: [legada, nueva]. */
export const SECURE_STORE_KEY_MIGRATIONS: ReadonlyArray<readonly [string, string]> = [
  ['micaja.accessToken', 'vendelo.accessToken'],
  ['micaja.refreshToken', 'vendelo.refreshToken'],
  ['micaja.accessExp', 'vendelo.accessExp'],
  ['micaja.sessionUser', 'vendelo.sessionUser'],
  ['micaja.activeBusinessId', 'vendelo.activeBusinessId'],
];

export type MigrationDeps = {
  asyncGetItem: (key: string) => Promise<string | null>;
  asyncSetItem: (key: string, value: string) => Promise<void>;
  asyncRemoveItem: (key: string) => Promise<void>;
  secureGetItem: (key: string) => Promise<string | null>;
  secureSetItem: (key: string, value: string) => Promise<void>;
  secureDeleteItem: (key: string) => Promise<void>;
  renameDatabase: () => Promise<void>;
};

async function migratePairs(
  pairs: ReadonlyArray<readonly [string, string]>,
  get: (key: string) => Promise<string | null>,
  set: (key: string, value: string) => Promise<void>,
  remove: (key: string) => Promise<void>,
): Promise<number> {
  let moved = 0;
  for (const [legacyKey, newKey] of pairs) {
    try {
      const legacyValue = await get(legacyKey);
      if (legacyValue === null) continue;
      const currentValue = await get(newKey);
      // Si la clave nueva ya existe manda ella: no se pisa un dato mas nuevo.
      if (currentValue === null) {
        await set(newKey, legacyValue);
        moved += 1;
      }
      await remove(legacyKey);
    } catch {
      // Clave a clave: un fallo puntual no puede abortar el resto de la migracion.
    }
  }
  return moved;
}

export async function runStorageMigration(deps: MigrationDeps): Promise<{ moved: number; databaseRenamed: boolean }> {
  if ((await deps.asyncGetItem(MIGRATION_FLAG_KEY)) !== null) {
    return { moved: 0, databaseRenamed: false };
  }

  const moved =
    (await migratePairs(
      ASYNC_STORAGE_KEY_MIGRATIONS,
      deps.asyncGetItem,
      deps.asyncSetItem,
      deps.asyncRemoveItem,
    )) +
    (await migratePairs(
      SECURE_STORE_KEY_MIGRATIONS,
      deps.secureGetItem,
      deps.secureSetItem,
      deps.secureDeleteItem,
    ));

  let databaseRenamed = false;
  try {
    await deps.renameDatabase();
    databaseRenamed = true;
  } catch {
    // En web no hay SQLite y el archivo puede no existir: se ignora.
  }

  await deps.asyncSetItem(MIGRATION_FLAG_KEY, '1');
  return { moved, databaseRenamed };
}

/** Renombra el archivo de SQLite y sus archivos acompanantes de WAL, si existen. */
async function renameDatabaseFile(): Promise<void> {
  const { Platform } = require('react-native');
  if (Platform.OS === 'web') return;

  const { documentDirectory, getInfoAsync, moveAsync, deleteAsync } = require('expo-file-system/legacy');
  if (!documentDirectory) return;

  const base = `${documentDirectory}SQLite/`;
  for (const suffix of ['', '-wal', '-shm']) {
    const from = `${base}${LEGACY_DATABASE_NAME}${suffix}`;
    const to = `${base}${DATABASE_NAME}${suffix}`;
    const info = await getInfoAsync(from);
    if (!info.exists) continue;
    // Si el destino ya existe la base nueva manda: se descarta el archivo viejo.
    if ((await getInfoAsync(to)).exists) {
      await deleteAsync(from, { idempotent: true });
    } else {
      await moveAsync(from, to);
    }
  }
}

/** Ejecuta la migracion contra los almacenes reales de la plataforma. */
export async function migrateLegacyStorage(): Promise<void> {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const secure = () => require('expo-secure-store');

  await runStorageMigration({
    asyncGetItem: (key) => AsyncStorage.getItem(key),
    asyncSetItem: (key, value) => AsyncStorage.setItem(key, value),
    asyncRemoveItem: (key) => AsyncStorage.removeItem(key),
    secureGetItem: async (key) => {
      const { getItemAsync } = secure();
      return getItemAsync(key);
    },
    secureSetItem: async (key, value) => {
      const { setItemAsync } = secure();
      return setItemAsync(key, value);
    },
    secureDeleteItem: async (key) => {
      const { deleteItemAsync } = secure();
      return deleteItemAsync(key);
    },
    renameDatabase: renameDatabaseFile,
  });
}
