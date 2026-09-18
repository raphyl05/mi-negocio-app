import { createInMemoryOrderRepository } from '../src/repositories/orderRepository';
import { buildOrder } from '../src/utils/order';
import type { CartItem } from '../src/utils/cart';
import type { Product } from '../src/models/product';

const burger: Product = {
  id: 'p1',
  name: 'Hamburguesa',
  priceCents: 25000,
  category: 'Comidas',
  imageType: 'emoji',
  emoji: '🍔',
  trackStock: false,
  stockQuantity: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const emptyCustomer = { customerName: '', phone: '', address: '', description: '' };
const items: CartItem[] = [{ product: burger, quantity: 1 }];

describe('orderRepository (en memoria)', () => {
  it('asigna números consecutivos a las órdenes', async () => {
    const repo = createInMemoryOrderRepository();
    const first = await repo.save(buildOrder({ items, customer: emptyCustomer, status: 'pending' }));
    const second = await repo.save(buildOrder({ items, customer: emptyCustomer, status: 'paid' }));
    expect(first.number).toBe(1);
    expect(second.number).toBe(2);
  });

  it('separar pendientes y pagadas', async () => {
    const repo = createInMemoryOrderRepository();
    await repo.save(buildOrder({ items, customer: emptyCustomer, status: 'pending' }));
    await repo.save(buildOrder({ items, customer: emptyCustomer, status: 'paid' }));

    const pending = await repo.listPending();
    const paid = await repo.listPaid();
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('pending');
    expect(paid).toHaveLength(1);
    expect(paid[0].status).toBe('paid');
  });

  it('actualiza y elimina órdenes', async () => {
    const repo = createInMemoryOrderRepository();
    const order = await repo.save(buildOrder({ items, customer: emptyCustomer, status: 'pending' }));

    const updated = { ...order, customer: { ...emptyCustomer, customerName: 'Juan Pérez' } };
    await repo.update(updated);
    const found = await repo.getById(order.id);
    expect(found?.customer.customerName).toBe('Juan Pérez');

    await repo.remove(order.id);
    expect(await repo.getById(order.id)).toBeNull();
  });

  it('devuelve null si la orden no existe', async () => {
    const repo = createInMemoryOrderRepository();
    expect(await repo.getById('no-existe')).toBeNull();
  });
});