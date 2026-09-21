jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createInMemoryProductRepository } from '../src/repositories/productRepository';
import { ensureSyncState, touchSyncState } from '../src/services/syncStateService';
import { getBusiness, saveBusiness } from '../src/services/setupService';
import { getDeviceId, resetDeviceIdCache } from '../src/utils/syncIdentity';
import { parseBackup, serializeBackup, validateBackupData } from '../src/utils/backup';
import type { BackupBundle } from '../src/utils/backup';
import type { Product } from '../src/models/product';

const product = (extra: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'Hamburguesa',
  priceCents: 25000,
  category: 'Comidas',
  imageType: 'emoji',
  stockQuantity: 5,
  active: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  ...extra,
});

const bundle = (products: unknown[]): BackupBundle => ({
  app: 'vendelo',
  version: 1,
  exportedAt: '2026-09-21T10:00:00.000Z',
  business: { name: 'B1', createdAt: '2026-09-01T00:00:00.000Z' },
  user: null,
  cashRegister: null,
  cashClosures: null,
  printer: null,
  products: products as Product[],
  orders: [],
  customers: [],
  providers: [],
});

describe('compatibilidad del respaldo con los campos de sincronización', () => {
  it('acepta respaldos antiguos sin updatedAt ni deletedAt', () => {
    const invalid = validateBackupData(bundle([product()]));
    expect(invalid).toBeNull();
    const res = parseBackup(serializeBackup(bundle([product()])));
    expect(res.ok).toBe(true);
  });

  it('acepta y conserva los campos nuevos en el round-trip', () => {
    const withNew = bundle([
      product({ updatedAt: '2026-09-02T00:00:00.000Z', deletedAt: '2026-09-03T00:00:00.000Z' }),
    ]);
    expect(validateBackupData(withNew)).toBeNull();
    const res = parseBackup(serializeBackup(withNew));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.bundle.products[0].updatedAt).toBe('2026-09-02T00:00:00.000Z');
      expect(res.bundle.products[0].deletedAt).toBe('2026-09-03T00:00:00.000Z');
    }
  });

  it('rechaza un respaldo con updatedAt no válido', () => {
    const res = parseBackup(JSON.stringify({ app: 'vendelo', version: 1, products: [product({ updatedAt: 'ayer' })] }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain('updatedAt');
  });

  it('al restaurar un producto antiguo se rellena updatedAt = createdAt', async () => {
    const repo = createInMemoryProductRepository();
    const restored = await repo.create(product() as unknown as Product);
    expect(restored.updatedAt).toBe(restored.createdAt);
  });
});

describe('identidad del dispositivo y del negocio', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetDeviceIdCache();
  });

  it('getDeviceId es estable en el tiempo', async () => {
    const first = await getDeviceId();
    const second = await getDeviceId();
    expect(second).toBe(first);
    expect(await AsyncStorage.getItem('@micaja/deviceId')).toBe(first);
  });

  it('un dispositivo limpio genera una identidad nueva', async () => {
    const first = await getDeviceId();
    await AsyncStorage.clear();
    resetDeviceIdCache();
    const regenerated = await getDeviceId();
    expect(regenerated).not.toBe(first);
  });

  it('ensureSyncState crea la fila y la reutiliza', async () => {
    const created = await ensureSyncState('biz-1');
    expect(created.businessId).toBe('biz-1');
    expect(created.deviceId).toBeTruthy();
    expect(created.status).toBe('idle');

    const again = await ensureSyncState('biz-1');
    expect(again.id).toBe(created.id);
    expect(again.updatedAt).toBe(created.updatedAt);
  });

  it('touchSyncState registra el último sincronizado y el cursor', async () => {
    await ensureSyncState('biz-1');
    const touched = await touchSyncState({ lastSyncAt: '2026-09-21T12:00:00.000Z', lastServerCursor: 'c-42', status: 'syncing' });
    expect(touched?.lastSyncAt).toBe('2026-09-21T12:00:00.000Z');
    expect(touched?.lastServerCursor).toBe('c-42');
    expect(touched?.status).toBe('syncing');
  });

  it('saveBusiness asigna id si falta y lo conserva si existe', async () => {
    await saveBusiness({ name: 'Local', createdAt: '2026-01-01T00:00:00.000Z' });
    const stored = await getBusiness();
    expect(stored?.id).toBeTruthy();
    const id = stored?.id;

    await saveBusiness({ id, name: 'Local Renombrado', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' });
    const renamed = await getBusiness();
    expect(renamed?.id).toBe(id);
    expect(renamed?.name).toBe('Local Renombrado');
    expect(renamed?.updatedAt).toBe('2026-02-01T00:00:00.000Z');
  });
});