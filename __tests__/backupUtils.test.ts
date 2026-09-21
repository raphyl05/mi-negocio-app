import { deriveNextOrderNumber, parseBackup, sanitizeUserForBackup, serializeBackup } from '../src/utils/backup';
import type { BackupBundle } from '../src/utils/backup';

  const baseBundle = (): BackupBundle => ({
    app: 'vendelo',
    version: 1,
    exportedAt: '2026-09-19T10:00:00.000Z',
    business: { name: 'B1', createdAt: '' },
    user: { id: 'u1', username: 'u', createdAt: '' },
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

  describe('sanitizeUserForBackup', () => {
    it('quita el hash, la sal y la pregunta de seguridad del respaldo', () => {
      const sanitized = sanitizeUserForBackup({
        id: 'u1',
        username: 'vendedor',
        passwordHash: 'ab12',
        passwordSalt: 'cd34',
        securityQuestion: '¿Mascota?',
        securityAnswerHash: 'ef56',
        securityAnswerSalt: 'gh78',
        createdAt: '2026-09-19T10:00:00.000Z',
      });
      expect(sanitized).toEqual({ id: 'u1', username: 'vendedor', createdAt: '2026-09-19T10:00:00.000Z' });
    });

    it('el JSON exportado nunca contiene credenciales', () => {
      const bundle: BackupBundle = {
        ...baseBundle(),
        user: sanitizeUserForBackup({
          id: 'u1',
          username: 'vendedor',
          passwordHash: 'hash-secreto',
          passwordSalt: 'sal-secreta',
          securityQuestion: 'q',
          securityAnswerHash: 'ah',
          securityAnswerSalt: 'as',
          createdAt: '2026-09-19T10:00:00.000Z',
        }),
      };
      const json = serializeBackup(bundle);
      expect(json).not.toContain('hash-secreto');
      expect(json).not.toContain('sal-secreta');
      expect(json).not.toContain('securityQuestion');
      expect(json).not.toContain('securityAnswerHash');
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

    it('acepta un respaldo completo y válido', () => {
      const product = {
        id: 'p1',
        name: 'Hamburguesa',
        priceCents: 25000,
        category: 'Comidas',
        imageType: 'emoji',
        stockQuantity: 5,
        active: true,
        createdAt: '2026-09-01T00:00:00.000Z',
      };
      const order = {
        id: 'o1',
        number: 1,
        items: [{ product, quantity: 2 }],
        subtotalCents: 50000,
        customer: { customerName: 'Ana', phone: '', address: '', description: '' },
        status: 'paid',
        paymentMethod: 'cash',
        receivedCents: 60000,
        changeCents: 10000,
        createdAt: '2026-09-18T10:00:00.000Z',
        paidAt: '2026-09-18T10:05:00.000Z',
      };
      const closure = {
        id: 'c1',
        closedAt: '2026-09-18T18:00:00.000Z',
        openingAmountCents: 0,
        expectedCashCents: 50000,
        countedCashCents: 50000,
        differenceCents: 0,
      };
      const res = parseBackup(JSON.stringify({ app: 'vendelo', version: 1, products: [product], orders: [order], cashClosures: [closure] }));
      expect(res.ok).toBe(true);
    });

    it('rechaza un producto sin precio', () => {
      const res = parseBackup(JSON.stringify({
        app: 'vendelo',
        version: 1,
        products: [{ id: 'p1', name: 'Pan' } as any],
      }));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.message).toContain('Producto #1');
    });

    it('rechaza una orden con estado inválido', () => {
      const res = parseBackup(JSON.stringify({
        app: 'vendelo',
        version: 1,
        orders: [{ id: 'o1', number: 1, status: 'pagado', items: [], subtotalCents: 0, customer: {}, createdAt: '' } as any],
      }));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.message).toContain('Orden #1');
    });

    it('rechaza una orden con items vacíos', () => {
      const res = parseBackup(JSON.stringify({
        app: 'vendelo',
        version: 1,
        orders: [{ id: 'o1', number: 1, status: 'pending', items: [], subtotalCents: 0, customer: {}, createdAt: '' } as any],
      }));
      expect(res.ok).toBe(false);
    });

    it('rechaza una orden paga con cambio mayor que lo recibido', () => {
      const res = parseBackup(JSON.stringify({
        app: 'vendelo',
        version: 1,
        orders: [{
          id: 'o1',
          number: 1,
          items: [{ product: { id: 'p1', name: 'Pan', priceCents: 100 }, quantity: 1 } as any],
          subtotalCents: 100,
          customer: { customerName: 'A', phone: '', address: '', description: '' },
          status: 'paid',
          paymentMethod: 'cash',
          receivedCents: 100,
          changeCents: 200,
          createdAt: '2026-09-18T10:00:00.000Z',
        }],
      }));
      expect(res.ok).toBe(false);
    });

    it('rechaza un cliente con fecha inválida', () => {
      const res = parseBackup(JSON.stringify({
        app: 'vendelo',
        version: 1,
        customers: [{ id: 'c1', name: 'Ana', createdAt: 'ayer' } as any],
      }));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.message).toContain('Cliente #1');
    });

    it('acepta un cierre de caja antiguo sin desglose (retrocompatible)', () => {
      const legacy = {
        id: 'c1',
        closedAt: '2026-08-01T18:00:00.000Z',
        openingAmountCents: 0,
        expectedCashCents: 1000,
        countedCashCents: 1000,
        differenceCents: 0,
      };
      const res = parseBackup(JSON.stringify({ app: 'vendelo', version: 1, cashClosures: [legacy] }));
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
