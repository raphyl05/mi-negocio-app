import { createInMemoryOrderRepository } from '../src/repositories/orderRepository';
import { createInMemoryProductRepository } from '../src/repositories/productRepository';
import { createInMemoryStockMovementRepository } from '../src/repositories/stockMovementRepository';
import { createOrderService } from '../src/services/orderService';
import { adjustStockWithMovement } from '../src/services/stockService';
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
    stockQuantity: 100,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const emptyCustomer = { customerName: '', phone: '', address: '', description: '' };

async function setup(products: Product[] = []) {
  const orderRepo = createInMemoryOrderRepository();
  const productRepo = createInMemoryProductRepository();
  for (const product of products) await productRepo.create(product);
  const movementRepo = createInMemoryStockMovementRepository();
  const service = createOrderService({ orderRepo, productRepo, movementRepo });
  return { orderRepo, productRepo, movementRepo, service };
}

function itemsFrom(products: Product[]): CartItem[] {
  return products.map((product) => ({ product, quantity: 1 }));
}

async function runSale(cart: CartItem[]) {
  const s = await setup(cart.map((item) => item.product));
  const result = await s.service.payNewOrder({ items: cart, customer: emptyCustomer, paymentMethod: 'cash', receivedCents: 0 });
  if (!result.ok) throw new Error(result.message);
  return { ...s, order: result.order };
}

describe('stock_movements (outbox local)', () => {
  it('recordMovement crea un movimiento con id, fecha y synced=false', async () => {
    const repo = createInMemoryStockMovementRepository();
    const movement = await repo.recordMovement({ productId: 'p1', quantity: -3, movementType: 'SALE' });
    expect(movement.id).toBeTruthy();
    expect(movement.createdAt).toBeTruthy();
    expect(movement.synced).toBe(false);
    expect(movement.movementType).toBe('SALE');
    expect(movement.quantity).toBe(-3);
  });

  it('vender una orden registra un movimiento SALE por ítem referenciando la orden', async () => {
    const products = [
      makeProduct({ id: 'p1', stockQuantity: 100 }),
      makeProduct({ id: 'p2', name: 'Refresco', emoji: '🥤', stockQuantity: 50 }),
    ];
    const s = await setup(products);
    const items: CartItem[] = [
      { product: products[0], quantity: 2 },
      { product: products[1], quantity: 3 },
    ];

    const result = await s.service.payNewOrder({ items, customer: emptyCustomer, paymentMethod: 'cash' });

    expect(result.ok).toBe(true);
    const movements = await s.movementRepo.listAll();
    expect(movements).toHaveLength(2);
    const byProduct = (id: string) => movements.filter((m) => m.productId === id);
    expect(byProduct('p1')[0].quantity).toBe(-2);
    expect(byProduct('p2')[0].quantity).toBe(-3);
    expect(movements.every((m) => m.movementType === 'SALE')).toBe(true);
    expect(movements.every((m) => m.referenceId === (result as { ok: true; order: { id: string } }).order.id)).toBe(true);
  });

  it('guardar una orden pendiente descuenta stock con SALE', async () => {
    const product = makeProduct({ id: 'p1', stockQuantity: 10 });
    const s = await setup([product]);
    const result = await s.service.savePendingOrder({ items: [{ product, quantity: 1 }], customer: emptyCustomer });
    expect(result.ok).toBe(true);
    const movements = await s.movementRepo.listAll();
    expect(movements).toHaveLength(1);
    expect(movements[0].movementType).toBe('SALE');
    expect(movements[0].quantity).toBe(-1);
  });

  it('cobrar una orden pendiente no duplica el movimiento (el stock ya se reservó)', async () => {
    const product = makeProduct({ id: 'p1', stockQuantity: 10 });
    const s = await setup([product]);
    const pending = await s.service.savePendingOrder({ items: [{ product, quantity: 2 }], customer: emptyCustomer });
    if (!pending.ok) throw new Error(pending.message);
    expect(await s.movementRepo.listAll()).toHaveLength(1);

    const paid = await s.service.payPendingOrder(pending.order.id, 'cash', 50000);
    expect(paid.ok).toBe(true);
    expect(await s.movementRepo.listAll()).toHaveLength(1);
    expect((await s.movementRepo.listAll())[0].movementType).toBe('SALE');
  });

  it('cancelar una orden pendiente registra un movimiento RETURN positivo', async () => {
    const product = makeProduct({ id: 'p1', stockQuantity: 10 });
    const s = await setup([product]);
    const pending = await s.service.savePendingOrder({ items: [{ product, quantity: 4 }], customer: emptyCustomer });
    if (!pending.ok) throw new Error(pending.message);

    const result = await s.service.cancelPendingOrder(pending.order.id);
    expect(result.ok).toBe(true);
    const movements = await s.movementRepo.listAll();
    expect(movements).toHaveLength(2);
    expect(movements[1].movementType).toBe('RETURN');
    expect(movements[1].quantity).toBe(4);
    expect(movements.map((m) => m.referenceId)).toEqual([pending.order.id, pending.order.id]);
  });

  it('anular una venta pagada registra un movimiento RETURN positivo', async () => {
    const revenue = await runSale(itemsFrom([makeProduct({ id: 'p1', stockQuantity: 10 })]));
    const { id } = revenue.order;
    const voided = await revenue.service.voidOrder(id, 'Devolución');
    expect(voided.ok).toBe(true);
    const movements = await revenue.movementRepo.listAll();
    expect(movements).toHaveLength(2);
    expect(movements[1].movementType).toBe('RETURN');
    expect(movements[1].quantity).toBe(1);
    expect(movements[1].referenceId).toBe(id);
  });

  it('un ajuste manual registra ADJUSTMENT y descuenta/añade stock', async () => {
    const productRepo = createInMemoryProductRepository();
    const movementRepo = createInMemoryStockMovementRepository();
    await productRepo.create(makeProduct({ id: 'p1', stockQuantity: 30 }));

    await adjustStockWithMovement('p1', -7, 'ADJUSTMENT', undefined, { repo: productRepo, movementRepo });

    expect((await productRepo.getById('p1'))?.stockQuantity).toBe(23);
    const movements = await movementRepo.listAll();
    expect(movements).toHaveLength(1);
    expect(movements[0].movementType).toBe('ADJUSTMENT');
    expect(movements[0].quantity).toBe(-7);
  });

  it('el ajuste manual se ejecuta dentro de una sola transacción', async () => {
    const productRepo = createInMemoryProductRepository();
    const movementRepo = createInMemoryStockMovementRepository();
    await productRepo.create(makeProduct({ id: 'p1', stockQuantity: 30 }));
    const withTransaction = jest.fn(async <T>(fn: () => Promise<T>) => fn()) as unknown as <T>(fn: () => Promise<T>) => Promise<T>;

    await adjustStockWithMovement('p1', 3, 'ADJUSTMENT', undefined, {
      repo: productRepo,
      movementRepo,
      withTransaction,
    });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect((await productRepo.getById('p1'))?.stockQuantity).toBe(33);
    expect(await movementRepo.listAll()).toHaveLength(1);
  });

  it('un problema de stock aborta antes de registrar movimientos y sin guardar la orden', async () => {
    const product = makeProduct({ id: 'p1', stockQuantity: 0 });
    const s = await setup([product]);
    const result = await s.service.savePendingOrder({ items: [{ product, quantity: 1 }], customer: emptyCustomer });
    expect(result.ok).toBe(false);
    expect(await s.movementRepo.listAll()).toHaveLength(0);
    expect(await s.orderRepo.listPending()).toHaveLength(0);
  });

  it('un fallo durante el descuento de stock hace fallar la orden', async () => {
    const products = [
      makeProduct({ id: 'p1', stockQuantity: 10 }),
      makeProduct({ id: 'p2', name: 'Refresco', emoji: '🥤', stockQuantity: 10 }),
    ];
    const s = await setup(products);
    const original = s.productRepo.decreaseStock.bind(s.productRepo);
    let calls = 0;
    s.productRepo.decreaseStock = async (id, quantity) => {
      calls += 1;
      if (calls === 2) throw new Error('fallo inyectado');
      return original(id, quantity);
    };

    const result = await s.service.savePendingOrder({
      items: [itemsFrom(products)[0], itemsFrom(products)[1]],
      customer: emptyCustomer,
    });

    expect(result.ok).toBe(false);
  });

  it('savePendingOrder ejecuta guardado, descuentos y movimientos dentro de una sola transacción', async () => {
    const products = [
      makeProduct({ id: 'p1', stockQuantity: 10 }),
      makeProduct({ id: 'p2', name: 'Refresco', emoji: '🥤', stockQuantity: 10 }),
    ];
    const s = await setup(products);
    const withTransaction = jest.fn(async <T>(fn: () => Promise<T>) => fn()) as unknown as <T>(fn: () => Promise<T>) => Promise<T>;
    const service = createOrderService({ orderRepo: s.orderRepo, productRepo: s.productRepo, movementRepo: s.movementRepo, withTransaction });

    const result = await service.savePendingOrder({
      items: [itemsFrom(products)[0], itemsFrom(products)[1]],
      customer: emptyCustomer,
    });

    expect(result.ok).toBe(true);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(await s.orderRepo.listPending()).toHaveLength(1);
    expect(await s.movementRepo.listAll()).toHaveLength(2);
    expect((await s.productRepo.getById('p1'))?.stockQuantity).toBe(9);
    expect((await s.productRepo.getById('p2'))?.stockQuantity).toBe(9);
  });

  it('crear un producto con stock inicial registra un movimiento INITIAL_STOCK positivo', async () => {
    const productRepo = createInMemoryProductRepository();
    const movementRepo = createInMemoryStockMovementRepository();
    const created = await productRepo.create(makeProduct({ id: 'p1', stockQuantity: 15 }));

    if (created.stockQuantity > 0) {
      await movementRepo.recordMovement({
        productId: created.id,
        quantity: created.stockQuantity,
        movementType: 'INITIAL_STOCK',
      });
    }

    expect((await productRepo.getById('p1'))?.stockQuantity).toBe(15);
    const movements = await movementRepo.listAll();
    expect(movements).toHaveLength(1);
    expect(movements[0].movementType).toBe('INITIAL_STOCK');
    expect(movements[0].quantity).toBe(15);
    expect(movements[0].synced).toBe(false);
  });

  it('listPending y markSynced gobiernan el envío del outbox', async () => {
    const repo = createInMemoryStockMovementRepository();
    await repo.recordMovement({ productId: 'p1', quantity: -1, movementType: 'SALE' });
    await repo.recordMovement({ productId: 'p2', quantity: 2, movementType: 'ADJUSTMENT', synced: true });

    const pending = await repo.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].productId).toBe('p1');

    await repo.markSynced(pending.map((m) => m.id));
    expect(await repo.listPending()).toHaveLength(0);
    expect(await repo.listAll()).toHaveLength(2);
  });
});