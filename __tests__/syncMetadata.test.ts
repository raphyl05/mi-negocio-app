import { createInMemoryCustomerRepository } from '../src/repositories/customerRepository';
import { createInMemoryProviderRepository } from '../src/repositories/providerRepository';
import { createInMemoryOrderRepository } from '../src/repositories/orderRepository';
import { createInMemoryProductRepository } from '../src/repositories/productRepository';
import { createInMemorySyncStateRepository } from '../src/repositories/syncStateRepository';
import { buildOrder } from '../src/utils/order';
import type { CartItem } from '../src/utils/cart';
import type { Product } from '../src/models/product';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Hamburguesa',
    priceCents: 25000,
    category: 'Comidas',
    imageType: 'emoji',
    emoji: '🍔',
    stockQuantity: 10,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const emptyCustomer = { customerName: '', phone: '', address: '', description: '' };
const items: CartItem[] = [{ product: makeProduct(), quantity: 1 }];
const baseCustomer = { id: 'c1', name: 'Ana', phone: '', address: '', note: '', createdAt: '2026-01-01T00:00:00.000Z' };
const baseProvider = { id: 'r1', name: 'Proveedor', phone: '', address: '', note: '', createdAt: '2026-01-01T00:00:00.000Z' };

describe('metadatos de sincronización (updatedAt / deletedAt)', () => {
  describe('productos', () => {
    it('create fija updatedAt por defecto (createdAt cuando no se pasa)', async () => {
      const repo = createInMemoryProductRepository();
      const created = await repo.create(makeProduct());
      expect(created.updatedAt).toBe(created.createdAt);
    });

    it('update sobrescribe updatedAt con la fecha actual', async () => {
      const repo = createInMemoryProductRepository();
      const created = await repo.create(makeProduct({ updatedAt: '2026-01-01T00:00:00.000Z' }));
      const updated = await repo.update({ ...created, name: 'Renombrado' });
      expect(updated.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
      expect(updated.name).toBe('Renombrado');
    });

    it('remove deja tombstones invisibles para list/get y visibles en listIncludingDeleted', async () => {
      const repo = createInMemoryProductRepository();
      const created = await repo.create(makeProduct());
      await repo.create(makeProduct({ id: 'p2' }));

      await repo.remove(created.id);

      expect(await repo.getById(created.id)).toBeNull();
      expect((await repo.list()).some((p) => p.id === created.id)).toBe(false);
      expect((await repo.listByCategory('Comidas')).some((p) => p.id === created.id)).toBe(false);

      const all = await repo.listIncludingDeleted();
      const gone = all.find((p) => p.id === created.id);
      expect(gone).toBeDefined();
      expect(gone?.deletedAt).toBeDefined();
      expect(gone?.updatedAt).toBe(gone?.deletedAt);
    });

    it('hardRemove borra físicamente incluida la tombstone', async () => {
      const repo = createInMemoryProductRepository();
      const created = await repo.create(makeProduct());
      await repo.remove(created.id);
      await repo.hardRemove(created.id);
      expect((await repo.listIncludingDeleted()).some((p) => p.id === created.id)).toBe(false);
    });

    it('removeByCategory marca tombstones y renameCategory conserva los borrados', async () => {
      const repo = createInMemoryProductRepository();
      await repo.create(makeProduct({ id: 'a', category: 'Especiales' }));
      await repo.create(makeProduct({ id: 'b', category: 'Especiales' }));
      await repo.create(makeProduct({ id: 'c', category: 'Otros' }));

      const removed = await repo.removeByCategory('Especiales');
      expect(removed).toBe(2);
      expect(await repo.listByCategory('Especiales')).toHaveLength(0);
      expect((await repo.listIncludingDeleted()).filter((p) => p.deletedAt)).toHaveLength(2);

      const renamed = await repo.renameCategory('Otros', 'Refrescos');
      expect(renamed).toBe(1);
      const after = await repo.listIncludingDeleted();
      expect(after.filter((p) => p.category === 'Refrescos')).toHaveLength(1);
    });
  });

  describe('clientes y proveedores', () => {
    it('create/update/remove del cliente mantienen updatedAt y tombstones', async () => {
      const repo = createInMemoryCustomerRepository();
      const created = await repo.create({ ...baseCustomer, updatedAt: '2026-01-01T00:00:00.000Z' });
      expect(created.updatedAt).toBe('2026-01-01T00:00:00.000Z');

      const updated = await repo.update({ ...created, phone: '809-555-0000' });
      expect(updated.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');

      await repo.remove(created.id);
      expect(await repo.getById(created.id)).toBeNull();
      expect(await repo.list()).toEqual([]);
      const gone = (await repo.listIncludingDeleted()).find((c) => c.id === created.id);
      expect(gone?.deletedAt).toBeDefined();
    });

    it('create del proveedor fija updatedAt y hardRemove lo borra', async () => {
      const repo = createInMemoryProviderRepository();
      const created = await repo.create(baseProvider);
      expect(created.updatedAt).toBe(created.createdAt);
      await repo.hardRemove(created.id);
      expect(await repo.listIncludingDeleted()).toEqual([]);
    });
  });

  describe('órdenes', () => {
    it('buildOrder fija updatedAt y save lo conserva', async () => {
      const repo = createInMemoryOrderRepository();
      const order = buildOrder({ items, customer: emptyCustomer, status: 'paid' });
      expect(order.updatedAt).toBeDefined();
      const saved = await repo.save(order);
      expect(saved.updatedAt).toBe(order.updatedAt);
    });

    it('update sobrescribe updatedAt', async () => {
      const repo = createInMemoryOrderRepository();
      const order = await repo.save(buildOrder({ items, customer: emptyCustomer, status: 'pending' }));
      const updated = await repo.update({
        ...order,
        customer: { ...emptyCustomer, customerName: 'Juan' },
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
      expect(updated.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
    });

    it('remove deja la orden cancelada oculta y visible en listAllIncludingDeleted', async () => {
      const repo = createInMemoryOrderRepository();
      const order = await repo.save(buildOrder({ items, customer: emptyCustomer, status: 'pending' }));
      await repo.remove(order.id);

      expect(await repo.getById(order.id)).toBeNull();
      expect(await repo.listPending()).toHaveLength(0);
      expect(await repo.listAll()).toHaveLength(0);
      const gone = (await repo.listAllIncludingDeleted()).find((o) => o.id === order.id);
      expect(gone).toBeDefined();
    });

    it('las ventas pagadas siguen siendo inmutables', async () => {
      const repo = createInMemoryOrderRepository();
      const order = await repo.save(buildOrder({ items, customer: emptyCustomer, status: 'paid' }));
      const paidAt = order.paidAt;
      await expect(
        repo.update({ ...order, status: 'paid', paidAt }),
      ).rejects.toThrow('no puede modificarse');
    });
  });

  describe('sync_state', () => {
    it('save crea la fila y get la devuelve con estado por defecto', async () => {
      const repo = createInMemorySyncStateRepository();
      const saved = await repo.save({
        deviceId: 'dev-1',
        businessId: 'biz-1',
        status: 'idle',
        updatedAt: '2026-09-21T10:00:00.000Z',
      });
      expect(saved.id).toBeTruthy();
      const read = await repo.get();
      expect(read).toEqual(saved);
      expect(read?.status).toBe('idle');
    });

    it('save sobrescribe la fila única', async () => {
      const repo = createInMemorySyncStateRepository();
      await repo.save({ deviceId: 'dev-1', businessId: 'biz-1', status: 'idle', updatedAt: 'a' });
      await repo.save({ deviceId: 'dev-1', businessId: 'biz-1', status: 'syncing', updatedAt: 'b' });
      const read = await repo.get();
      expect(read?.status).toBe('syncing');
      expect(read?.updatedAt).toBe('b');
      expect(read?.id).toBeTruthy();
    });
  });
});