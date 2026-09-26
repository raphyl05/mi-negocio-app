import {
  ASYNC_STORAGE_KEY_MIGRATIONS,
  MIGRATION_FLAG_KEY,
  SECURE_STORE_KEY_MIGRATIONS,
  runStorageMigration,
  type MigrationDeps,
} from '../src/utils/storageMigration';

type Store = Record<string, string>;

function makeDeps(asyncStore: Store = {}, secureStore: Store = {}) {
  const asyncSet = jest.fn(async (key: string, value: string) => {
    asyncStore[key] = value;
  });
  const secureSet = jest.fn(async (key: string, value: string) => {
    secureStore[key] = value;
  });
  const renameDatabase = jest.fn(async () => {});

  const deps: MigrationDeps = {
    asyncGetItem: async (key) => asyncStore[key] ?? null,
    asyncSetItem: asyncSet,
    asyncRemoveItem: async (key) => {
      delete asyncStore[key];
    },
    secureGetItem: async (key) => secureStore[key] ?? null,
    secureSetItem: secureSet,
    secureDeleteItem: async (key) => {
      delete secureStore[key];
    },
    renameDatabase,
  };

  return { deps, asyncStore, secureStore, asyncSet, secureSet, renameDatabase };
}

describe('migración de almacenamiento MiCaja -> Vendelo App', () => {
  it('copia cada clave de AsyncStorage y borra la vieja', async () => {
    const asyncStore: Store = {
      '@micaja/business': '{"id":"b1"}',
      '@micaja/cashRegister': '{"id":"r1"}',
      '@micaja/deviceId': 'device-uuid',
      'micaja.offlineSession': '{"user":{"id":"u1"}}',
    };
    const { deps } = makeDeps(asyncStore);

    const result = await runStorageMigration(deps);

    expect(result.moved).toBe(4);
    expect(asyncStore['@vendelo/business']).toBe('{"id":"b1"}');
    expect(asyncStore['@vendelo/cashRegister']).toBe('{"id":"r1"}');
    expect(asyncStore['@vendelo/deviceId']).toBe('device-uuid');
    expect(asyncStore['vendelo.offlineSession']).toBe('{"user":{"id":"u1"}}');
    expect(asyncStore['@micaja/business']).toBeUndefined();
    expect(asyncStore['@micaja/cashRegister']).toBeUndefined();
    expect(asyncStore['@micaja/deviceId']).toBeUndefined();
    expect(asyncStore['micaja.offlineSession']).toBeUndefined();
  });

  it('copia los tokens de SecureStore y borra los viejos', async () => {
    const secureStore: Store = {
      'micaja.accessToken': 'access-1',
      'micaja.refreshToken': 'refresh-1',
      'micaja.activeBusinessId': 'b1',
    };
    const { deps } = makeDeps({}, secureStore);

    await runStorageMigration(deps);

    expect(secureStore['vendelo.accessToken']).toBe('access-1');
    expect(secureStore['vendelo.refreshToken']).toBe('refresh-1');
    expect(secureStore['vendelo.activeBusinessId']).toBe('b1');
    expect(secureStore['micaja.accessToken']).toBeUndefined();
    expect(secureStore['micaja.refreshToken']).toBeUndefined();
    expect(secureStore['micaja.activeBusinessId']).toBeUndefined();
  });

  it('renombra el archivo de la base de datos', async () => {
    const { deps, renameDatabase } = makeDeps();

    const result = await runStorageMigration(deps);

    expect(renameDatabase).toHaveBeenCalledTimes(1);
    expect(result.databaseRenamed).toBe(true);
  });

  it('no pisa un valor nuevo que ya exista en la clave nueva', async () => {
    const asyncStore: Store = {
      '@vendelo/business': '{"id":"nuevo"}',
      '@micaja/business': '{"id":"viejo"}',
    };
    const { deps } = makeDeps(asyncStore);

    const result = await runStorageMigration(deps);

    expect(asyncStore['@vendelo/business']).toBe('{"id":"nuevo"}');
    expect(asyncStore['@micaja/business']).toBeUndefined();
    expect(result.moved).toBe(0);
  });

  it('solo corre una vez gracias a la bandera', async () => {
    const asyncStore: Store = { [MIGRATION_FLAG_KEY]: '1', '@micaja/business': '{"id":"b1"}' };
    const { deps, renameDatabase } = makeDeps(asyncStore);

    const result = await runStorageMigration(deps);

    expect(result).toEqual({ moved: 0, databaseRenamed: false });
    expect(renameDatabase).not.toHaveBeenCalled();
    expect(asyncStore['@micaja/business']).toBe('{"id":"b1"}');
  });

  it('termina y marca la bandera aunque el renombrado de la base falle', async () => {
    const { deps, asyncStore, renameDatabase } = makeDeps({ '@micaja/theme': 'dark' });
    renameDatabase.mockRejectedValueOnce(new Error('sin archivo'));

    const result = await runStorageMigration(deps);

    expect(result.databaseRenamed).toBe(false);
    expect(asyncStore['@vendelo/theme']).toBe('dark');
    expect(asyncStore[MIGRATION_FLAG_KEY]).toBe('1');
  });

  it('no aborta la migración si una clave falla', async () => {
    const asyncStore: Store = { '@micaja/business': '{"id":"b1"}', '@micaja/printer': '{"device":"p1"}' };
    const { deps } = makeDeps(asyncStore);
    const originalGet = deps.asyncGetItem;
    deps.asyncGetItem = jest.fn(async (key: string) => {
      if (key === '@micaja/business') throw new Error('fallo puntual');
      return originalGet(key);
    });

    const result = await runStorageMigration(deps);

    expect(result.moved).toBe(1);
    expect(asyncStore['@vendelo/printer']).toBe('{"device":"p1"}');
  });

  it('cubre todas las claves renombradas en el código', () => {
    const migrated = new Set(
      [...ASYNC_STORAGE_KEY_MIGRATIONS, ...SECURE_STORE_KEY_MIGRATIONS].map(([, next]) => next),
    );
    // Cualquier clave @micaja/* que quede fuera de la lista no tendria migracion.
    expect([...migrated].sort()).toEqual(
      [
        '@vendelo/business',
        '@vendelo/cashClosures',
        '@vendelo/cashRegister',
        '@vendelo/deviceId',
        '@vendelo/driveToken',
        '@vendelo/lastVacuumAt',
        '@vendelo/pendingSync',
        '@vendelo/printer',
        '@vendelo/syncChanges',
        '@vendelo/syncRequestKeys',
        '@vendelo/theme',
        '@vendelo/user',
        'vendelo.accessExp',
        'vendelo.accessToken',
        'vendelo.activeBusinessId',
        'vendelo.offlineSession',
        'vendelo.refreshToken',
        'vendelo.sessionUser',
      ].sort(),
    );
  });
});
