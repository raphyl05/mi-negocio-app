import {
  buildBusinessBatch,
  buildCashClosureBatch,
  buildNamedBatch,
  buildOrderBatch,
  buildProductBatch,
  buildStockMovementBatch,
  cashClosureFromServer,
  customerFromServer,
  deletedAtOf,
  productFromServer,
  providerFromServer,
  orderFromServer,
  toStockMovementInput,
} from '../src/utils/syncMapper';
import type { Product } from '../src/models/product';
import type { Customer } from '../src/models/customer';
import type { Provider } from '../src/models/provider';
import type { Order } from '../src/models/order';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Hamburguesa',
    priceCents: 25000,
    category: 'Comidas',
    imageType: 'emoji',
    stockQuantity: 10,
    active: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'c1',
    name: 'Ana',
    phone: '809-555-0000',
    address: 'Calle 1',
    note: 'nota',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    number: 0,
    items: [{ product: makeProduct(), quantity: 2 }],
    subtotalCents: 50000,
    customer: { customerName: 'Ana', phone: '', address: '', description: '' },
    status: 'pending',
    orderType: 'counter',
    events: [{ type: 'created', at: '2026-09-01T00:00:00.000Z' }],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('syncMapper: batches de push', () => {
  it('buildProductBatch con upsert manda campeo completo', () => {
    const batch = buildProductBatch(makeProduct(), 'upsert');
    expect(batch).toMatchObject({ entityType: 'product', action: 'upsert', id: 'p1' });
    expect(batch.entity.name).toBe('Hamburguesa');
    expect(batch.entity.priceCents).toBe(25000);
    expect(batch.entity.openingStock).toBe(10);
  });

  it('buildProductBatch con delete manda solo id', () => {
    const batch = buildProductBatch(makeProduct(), 'delete');
    expect(batch).toEqual({ entityType: 'product', action: 'delete', id: 'p1', entity: { id: 'p1' } });
  });

  it('buildNamedBatch mapea phone/address/note para customer y provider', () => {
    const c = buildNamedBatch('customer', makeCustomer(), 'upsert');
    expect(c.entity).toMatchObject({ id: 'c1', name: 'Ana', phone: '809-555-0000', address: 'Calle 1', description: 'nota' });

    const provider: Provider = { ...makeCustomer(), id: 'r1', name: 'Prov' };
    const p = buildNamedBatch('provider', provider, 'delete');
    expect(p).toEqual({ entityType: 'provider', action: 'delete', id: 'r1', entity: { id: 'r1' } });
  });

  it('buildOrderBatch incluye estado, items y campos paid/void', () => {
    const batch = buildOrderBatch(makeOrder({ status: 'paid', paidAt: '2026-09-03T00:00:00.000Z' }), 'upsert');
    expect(batch.entity.status).toBe('paid');
    expect(batch.entity.totalCents).toBe(50000);
    expect(batch.entity.paidAt).toBe('2026-09-03T00:00:00.000Z');
    expect((batch.entity.items as unknown[])).toHaveLength(1);
  });

  it('buildOrderBatch con delete manda solo id', () => {
    const batch = buildOrderBatch(makeOrder(), 'delete');
    expect(batch).toEqual({ entityType: 'order', action: 'delete', id: 'o1', entity: { id: 'o1' } });
  });

  it('buildStockMovementBatch y buildCashClosureBatch son siempre upsert con id', () => {
    const sm = buildStockMovementBatch({ id: 'sm1', productId: 'p1', quantity: -2, movementType: 'SALE', deviceId: 'd1', createdAt: 'x', synced: true });
    expect(sm).toMatchObject({ entityType: 'stockMovement', action: 'upsert', id: 'sm1' });

    const cc = buildCashClosureBatch({ id: 'cc1', closedAt: 'z', openingAmountCents: 100, expectedCashCents: 90, countedCashCents: 85, differenceCents: 5, orderCount: 0, salesCents: 0, cashSalesCents: 0, transferSalesCents: 0 });
    expect(cc).toMatchObject({ entityType: 'cashClosure', action: 'upsert', id: 'cc1' });
  });

  it('buildBusinessBatch manda nombre y datos del negocio', () => {
    const batch = buildBusinessBatch({ id: 'biz1', name: 'Mi Negocio', ownerName: 'Ana', createdAt: 'x' });
    expect(batch.entity).toMatchObject({ id: 'biz1', name: 'Mi Negocio', ownerName: 'Ana' });
  });
});

describe('syncMapper: DTOs de pull', () => {
  it('productFromServer mapea campos y deletedAt cuando deleted', () => {
    const p = productFromServer({ id: 'p1', name: 'X', priceCents: 100, updatedAt: '2026-09-05T00:00:00.000Z', deleted: true });
    expect(p.name).toBe('X');
    expect(p.deletedAt).toBe('2026-09-05T00:00:00.000Z');
  });

  it('deletedAtOf usa updatedAt de los tombstones', () => {
    expect(deletedAtOf({ id: 'x', deleted: true, updatedAt: '2026-09-05T00:00:00.000Z' })).toBe('2026-09-05T00:00:00.000Z');
    expect(deletedAtOf({ id: 'x', updatedAt: '2026-09-05T00:00:00.000Z' })).toBeUndefined();
  });

  it('customerFromServer y providerFromServer conservan phone/address/note', () => {
    const c = customerFromServer({ id: 'c1', name: 'Ana', phone: '111', address: 'A', description: 'nota', createdAt: 'x' });
    expect(c.phone).toBe('111');
    expect(c.address).toBe('A');
    expect(c.note).toBe('nota');

    const p = providerFromServer({ id: 'r1', name: 'Prov', createdAt: 'x' });
    expect(p.name).toBe('Prov');
    expect(p.note).toBe('');
  });

  it('orderFromServer respeta paidAt/voidedAt/voidReason', () => {
    const o = orderFromServer({
      id: 'o1',
      number: 3,
      status: 'voided',
      items: [{ productId: 'p1', name: 'X', quantity: 1, unitPriceCents: 100 }],
      paidAt: '2026-09-03T00:00:00.000Z',
      voidedAt: '2026-09-04T00:00:00.000Z',
      voidReason: 'error del mesero',
      createdAt: 'x',
    });
    expect(o.status).toBe('voided');
    expect(o.paidAt).toBe('2026-09-03T00:00:00.000Z');
    expect(o.voidedAt).toBe('2026-09-04T00:00:00.000Z');
    expect(o.voidReason).toBe('error del mesero');
  });

  it('toStockMovementInput normaliza el tipo de movimiento', () => {
    const m = toStockMovementInput({ id: 'sm1', productId: 'p1', movementType: 'opening', quantity: 5, createdAt: 'x' });
    expect(m.movementType).toBe('INITIAL_STOCK');

    const sale = toStockMovementInput({ id: 'sm2', productId: 'p1', movementType: 'SALE', quantity: -2, createdAt: 'x' });
    expect(sale.movementType).toBe('SALE');
  });
});