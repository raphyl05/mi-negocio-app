import type { Order } from '../src/models/order';
import type { Product } from '../src/models/product';
import { filterOrders, normalizeSearchText, orderMatchesQuery } from '../src/utils/orderSearch';
import type { CartItem } from '../src/utils/cart';

const burger: Product = {
  id: 'p1',
  name: 'Hamburguesa',
  priceCents: 25000,
  category: 'Comidas',
  imageType: 'emoji',
  emoji: '🍔',
  stockQuantity: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const items: CartItem[] = [{ product: burger, quantity: 2 }];

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    number: 7,
    items,
    subtotalCents: 50000,
    customer: { customerName: 'Juan Pérez', phone: '809-555-1234', address: 'Santo Domingo Este', description: 'Sin cebolla' },
    status: 'pending',
    orderType: 'counter',
    events: [],
    createdAt: new Date(2026, 3, 12, 15, 45).toISOString(),
    ...overrides,
  };
}

describe('orderSearch', () => {
  it('normaliza tildes y mayúsculas', () => {
    expect(normalizeSearchText('  José  ')).toBe('jose');
  });

  it('coincide con nombre, teléfono, dirección, descripción y productos', () => {
    const order = makeOrder();
    expect(orderMatchesQuery(order, 'juan')).toBe(true);
    expect(orderMatchesQuery(order, '809 555 1234')).toBe(true);
    expect(orderMatchesQuery(order, 'santo domingo')).toBe(true);
    expect(orderMatchesQuery(order, 'cebolla')).toBe(true);
    expect(orderMatchesQuery(order, 'hamburguesa')).toBe(true);
  });

  it('coincide con número de orden', () => {
    expect(orderMatchesQuery(makeOrder(), '#7')).toBe(true);
    expect(orderMatchesQuery(makeOrder(), '7')).toBe(true);
  });

  it('coincide con el mismo código de factura pendiente o pagada', () => {
    expect(orderMatchesQuery(makeOrder(), 'FAC-0007')).toBe(true);
    expect(orderMatchesQuery(makeOrder(), 'fac-0007')).toBe(true);
    expect(orderMatchesQuery(makeOrder(), '0007')).toBe(true);
  });

  it('coincide con fecha y hora formateadas', () => {
    const order = makeOrder();
    expect(orderMatchesQuery(order, '12/04/2026')).toBe(true);
    expect(orderMatchesQuery(order, '3:45 p.m.')).toBe(true);
  });

  it('coincide sin tildes en la búsqueda', () => {
    expect(orderMatchesQuery(makeOrder(), 'perez')).toBe(true);
  });

it('coincide con acento en el dato original', () => {
    expect(orderMatchesQuery(makeOrder({ customer: { ...makeOrder().customer, customerName: 'José Gómez' } }), 'jose')).toBe(true);
  });

  it('no coincide con texto ajeno', () => {
    expect(orderMatchesQuery(makeOrder(), 'pizza')).toBe(false);
    expect(orderMatchesQuery(makeOrder(), 'Maria Lopez')).toBe(false);
  });

  it('búsqueda vacía devuelve todo', () => {
    const pending = makeOrder({ number: 7 });
    const paid = makeOrder({ id: 'o2', number: 8, status: 'paid' });
    expect(filterOrders([pending, paid], '  ')).toHaveLength(2);
  });

  it('filtra las órdenes que coinciden', () => {
    const pending = makeOrder({ number: 7 });
    const paid = makeOrder({ id: 'o2', number: 8, status: 'paid', customer: { ...makeOrder().customer, customerName: 'María López' } });
    expect(filterOrders([pending, paid], 'juan')).toHaveLength(1);
  });
});