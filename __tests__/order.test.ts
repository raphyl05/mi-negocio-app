import { buildOrder } from '../src/utils/order';
import type { CartItem } from '../src/utils/cart';
import type { Product } from '../src/models/product';

const burger: Product = {
  id: 'p1',
  name: 'Hamburguesa',
  priceCents: 25000,
  category: 'Comidas',
  emoji: '🍔',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const soda: Product = {
  id: 'p2',
  name: 'Refresco',
  priceCents: 10000,
  category: 'Bebidas',
  emoji: '🥤',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const emptyCustomer = { customerName: '', phone: '', address: '', description: '' };

describe('buildOrder', () => {
  const items: CartItem[] = [
    { product: burger, quantity: 2 },
    { product: soda, quantity: 1 },
  ];

  it('calcula el subtotal desde los items', () => {
    const order = buildOrder({ items, customer: emptyCustomer, status: 'paid' });
    expect(order.subtotalCents).toBe(60000);
  });

  it('marca venta en efectivo con cambio', () => {
    const order = buildOrder({
      items,
      customer: emptyCustomer,
      status: 'paid',
      paymentMethod: 'cash',
      receivedCents: 100000,
    });
    expect(order.paymentMethod).toBe('cash');
    expect(order.receivedCents).toBe(100000);
    expect(order.changeCents).toBe(40000);
    expect(order.paidAt).toBeDefined();
  });

  it('transfiere sin recibido ni cambio', () => {
    const order = buildOrder({ items, customer: emptyCustomer, status: 'paid', paymentMethod: 'transfer' });
    expect(order.paymentMethod).toBe('transfer');
    expect(order.receivedCents).toBeUndefined();
    expect(order.changeCents).toBeUndefined();
  });

  it('orden pendiente no tiene fecha de pago', () => {
    const order = buildOrder({ items, customer: emptyCustomer, status: 'pending' });
    expect(order.status).toBe('pending');
    expect(order.paidAt).toBeUndefined();
  });
});