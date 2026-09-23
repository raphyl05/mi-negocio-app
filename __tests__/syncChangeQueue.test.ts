jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearSyncChanges,
  countSyncChanges,
  dequeueSyncChanges,
  enqueueSyncChange,
  isSyncTrackingEnabled,
  listSyncChanges,
  setSyncTrackingEnabled,
} from '../src/services/syncChangeQueue';

describe('syncChangeQueue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    setSyncTrackingEnabled(true);
  });

  afterEach(() => setSyncTrackingEnabled(true));

  it('encola un cambio con tipo, acción y clave compuesta', async () => {
    await enqueueSyncChange('product', 'p1', 'upsert');
    const changes = await listSyncChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      entityType: 'product',
      entityId: 'p1',
      action: 'upsert',
      key: 'product:p1',
    });
  });

  it('coalesce: upsert repetido mantiene una sola entrada', async () => {
    await enqueueSyncChange('product', 'p1', 'upsert');
    await enqueueSyncChange('product', 'p1', 'upsert');
    expect(await countSyncChanges()).toBe(1);
  });

  it('coalesce: delete gana frente a upsert posterior', async () => {
    await enqueueSyncChange('product', 'p1', 'delete');
    await enqueueSyncChange('product', 'p1', 'upsert');
    const changes = await listSyncChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].action).toBe('delete');
  });

  it('coalesce: upsert seguido de delete deja solo el delete', async () => {
    await enqueueSyncChange('order', 'o1', 'upsert');
    await enqueueSyncChange('order', 'o1', 'delete');
    const changes = await listSyncChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].action).toBe('delete');
  });

  it('mantiene entradas independientes por tipo+id', async () => {
    await enqueueSyncChange('product', 'p1', 'upsert');
    await enqueueSyncChange('customer', 'c1', 'upsert');
    await enqueueSyncChange('product', 'p2', 'upsert');
    expect(await countSyncChanges()).toBe(3);
  });

  it('dequeue elimina solo las claves indicadas', async () => {
    await enqueueSyncChange('product', 'p1', 'upsert');
    await enqueueSyncChange('product', 'p2', 'upsert');
    await dequeueSyncChanges(['product:p1']);
    const changes = await listSyncChanges();
    expect(changes.map((c) => c.entityId)).toEqual(['p2']);
  });

  it('dequeue con lista vacía no toca nada', async () => {
    await enqueueSyncChange('product', 'p1', 'upsert');
    await dequeueSyncChanges([]);
    expect(await countSyncChanges()).toBe(1);
  });

  it('clearSyncChanges vacía la cola', async () => {
    await enqueueSyncChange('product', 'p1', 'upsert');
    await clearSyncChanges();
    expect(await countSyncChanges()).toBe(0);
  });

  it('ignora ids vacíos', async () => {
    await enqueueSyncChange('product', '', 'upsert');
    await enqueueSyncChange('product', '   ', 'upsert');
    expect(await countSyncChanges()).toBe(0);
  });

  it('no encola mientras el tracking está desactivado', async () => {
    setSyncTrackingEnabled(false);
    expect(isSyncTrackingEnabled()).toBe(false);
    await enqueueSyncChange('product', 'p1', 'upsert');
    expect(await countSyncChanges()).toBe(0);
  });

  it('al reactivar el tracking vuelve a encolar', async () => {
    setSyncTrackingEnabled(false);
    await enqueueSyncChange('product', 'p1', 'upsert');
    setSyncTrackingEnabled(true);
    await enqueueSyncChange('product', 'p2', 'upsert');
    expect(await countSyncChanges()).toBe(1);
  });

  it('tolera datos corruptos en AsyncStorage y arranca vacío', async () => {
    await AsyncStorage.setItem('@micaja/syncChanges', '{no-es-json');
    await enqueueSyncChange('product', 'p1', 'upsert');
    expect(await countSyncChanges()).toBe(1);
  });

  it('persiste en AsyncStorage bajo @micaja/syncChanges', async () => {
    await enqueueSyncChange('product', 'p1', 'upsert');
    const raw = await AsyncStorage.getItem('@micaja/syncChanges');
    expect(raw).toBeDefined();
    expect(JSON.parse(raw as string)).toHaveProperty('product:p1');
  });
});