const memFs: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-file-system/legacy', () => {
  const exists = (path: string) => Object.prototype.hasOwnProperty.call(memFs, path);
  return {
    documentDirectory: 'memory://vendelo/',
    getInfoAsync: jest.fn(async (path: string) => ({ exists: exists(path) })),
    makeDirectoryAsync: jest.fn(async (path: string) => {
      if (!exists(path)) memFs[path] = '{dir}';
    }),
    writeAsStringAsync: jest.fn(async (path: string, content: string) => {
      memFs[path] = content;
    }),
    readDirectoryAsync: jest.fn(async (path: string) =>
      Object.keys(memFs).filter((key) => key.startsWith(path)).map((key) => key.slice(path.length)),
    ),
    deleteAsync: jest.fn(async (path: string) => {
      delete memFs[path];
    }),
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLocalAutoBackup } from '../src/services/autoBackupService';
import { closeRegister, openRegister } from '../src/services/cashRegisterService';

function snapshotNames(): string[] {
  return Object.keys(memFs)
    .filter((key) => key.includes('respaldo-auto-'))
    .map((key) => key.replace(/^.+\/(respaldo-auto-.+\.json)$/, '$1'))
    .sort();
}

describe('createLocalAutoBackup', () => {
  beforeEach(async () => {
    for (const key of Object.keys(memFs)) delete memFs[key];
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('escribe un respaldo JSON en la carpeta de documentos', async () => {
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-09-21T12:00:00.000Z');
    await createLocalAutoBackup();
    const names = snapshotNames();
    expect(names).toEqual(['respaldo-auto-2026-09-21T12-00-00-000Z.json']);
    expect(JSON.parse(memFs['memory://vendelo/vendelo/' + names[0]]).app).toBe('vendelo');
  });

  it('poda conservando solo los últimos 5 respaldos', async () => {
    for (const s of ['01', '02', '03', '04', '05', '06', '07']) {
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(`2026-09-21T12:00:${s}.000Z`);
      await createLocalAutoBackup();
      jest.restoreAllMocks();
    }
    const names = snapshotNames();
    expect(names).toHaveLength(5);
    expect(names[0]).toContain('12-00-03');
    expect(names[4]).toContain('12-00-07');
  });

  it('se crea tras cada cierre de caja sin romper el cierre', async () => {
    await openRegister(0);
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-09-21T12:00:00.000Z');
    const record = await closeRegister({
      openingAmountCents: 0,
      expectedCashCents: 0,
      countedCashCents: 0,
      differenceCents: 0,
      orderCount: 0,
      salesCents: 0,
      cashSalesCents: 0,
      transferSalesCents: 0,
    });
    expect(record.id).toBeTruthy();
    expect(snapshotNames()).toHaveLength(1);
  });
});