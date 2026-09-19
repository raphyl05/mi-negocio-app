import { deriveNextOrderNumber, parseBackup, serializeBackup } from '../src/utils/backup';
import type { BackupBundle } from '../src/utils/backup';

  const baseBundle = (): BackupBundle => ({
    app: 'vendelo',
    version: 1,
    exportedAt: '2026-09-19T10:00:00.000Z',
    business: { name: 'B1', createdAt: '' },
    user: { id: 'u1', username: 'u', passwordHash: 'h', passwordSalt: 's', createdAt: '' },
    cashRegister: null,
    cashClosures: null,
    printer: null,
    products: [],
    orders: [],
    customers: [],
    providers: [],
  });

describe('backup utils', () => {
  describe('serializeBackup', () => {
    it('genera JSON legible', () => {
      const json = serializeBackup(baseBundle());
      expect(json).toContain('"vendelo"');
      expect(JSON.parse(json)).toEqual(baseBundle());
    });
  });

  describe('parseBackup', () => {
    it('acepta un bundle válido', () => {
      const res = parseBackup(serializeBackup(baseBundle()));
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.bundle.exportedAt).toBe('2026-09-19T10:00:00.000Z');
    });

    it('rechaza JSON inválido', () => {
      const res = parseBackup('not-json');
      expect(res.ok).toBe(false);
    });

    it('rechaza app equivocado', () => {
      const res = parseBackup(JSON.stringify({ app: 'otro', version: 1 }));
      expect(res.ok).toBe(false);
    });

    it('rechaza versión no compatible', () => {
      const res = parseBackup(JSON.stringify({ app: 'vendelo', version: 2 }));
      expect(res.ok).toBe(false);
    });

    it('acepta arrays vacíos y objetos faltantes', () => {
      const res = parseBackup(JSON.stringify({ app: 'vendelo', version: 1, exportedAt: '' }));
      expect(res.ok).toBe(true);
    });
  });

  describe('deriveNextOrderNumber', () => {
    it('1 si no hay órdenes', () => {
      expect(deriveNextOrderNumber([])).toBe(1);
    });
    it('max+1 si hay órdenes', () => {
      expect(deriveNextOrderNumber([{ id: 'a', number: 3, createdAt: '' } as any, { id: 'b', number: 7, createdAt: '' } as any])).toBe(8);
    });
  });
});
