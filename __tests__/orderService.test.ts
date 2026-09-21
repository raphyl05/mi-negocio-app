import { createInMemoryOrderRepository } from '../src/repositories/orderRepository';
import { createInMemoryProductRepository } from '../src/repositories/productRepository';
import { createOrderService } from '../src/services/orderService';
import type { CartItem } from '../src/utils/cart';
import type { Product } from '../src/models/product';
import type { Order } from '../src/models/order';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Hamburguesa',
    priceCents: 500,
    category: 'Comidas',
    imageType: 'emoji',
    emoji: '🍔',
    stockQuantity: 5,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const emptyCustomer = { customerName: '', phone: '', address: '', description: '' };

const passThroughTxn = async <T>(fn: () => Promise<T>): Promise<T> => fn();

function setup() {
  const productRepo = createInMemoryProductRepository();
  const orderRepo = createInMemoryOrderRepository();
  const service = createOrderService({
    orderRepo,
    productRepo,
    withTransaction: passThroughTxn,
  });
  return { productRepo, orderRepo, service };
}

async function addProduct(repo: ReturnType<typeof createInMemoryProductRepository>, product?: Product) {
  const created = product ?? makeProduct();
  await repo.create(created);
  return created;
}

function itemsWith(product: Product, quantity: number): CartItem[] {
  return [{ product, quantity }];
}

describe('orderService', () => {
  it('guarda una orden pendiente y reserva stock', async () => {
    const { productRepo, orderRepo, service } = setup();
    const product = await addProduct(productRepo);

    const result = await service.savePendingOrder({ items: itemsWith(product, 2), customer: emptyCustomer });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.status).toBe('pending');
    expect((await productRepo.getById(product.id))?.stockQuantity).toBe(3);
    expect((await orderRepo.listPending())).toHaveLength(1);
  });

  it('rechaza guardar pendiente con stock insuficiente sin guardar la orden', async () => {
    const { productRepo, orderRepo, service } = setup();
    const product = await addProduct(productRepo);

    const result = await service.savePendingOrder({ items: itemsWith(product, 6), customer: emptyCustomer });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('Stock insuficiente');
    expect(await orderRepo.listAll()).toHaveLength(0);
    expect((await productRepo.getById(product.id))?.stockQuantity).toBe(5);
  });

  it('rechaza guardar pendiente con producto fuera del catálogo', async () => {
    const { productRepo, orderRepo, service } = setup();
    const product = await addProduct(productRepo);

    const r1 = await service.savePendingOrder({ items: itemsWith(product, 1), customer: emptyCustomer });
    expect(r1.ok).toBe(true);
    await productRepo.remove(product.id);

    const result = await service.savePendingOrder({ items: itemsWith(product, 1), customer: emptyCustomer });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('ya no está en el catálogo');
  });

  it('cobra una orden pagada nueva y reserva stock', async () => {
    const { productRepo, orderRepo, service } = setup();
    const product = await addProduct(productRepo);

    const result = await service.payNewOrder({ items: itemsWith(product, 2), customer: emptyCustomer, paymentMethod: 'cash', receivedCents: 1000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.status).toBe('paid');
    expect(result.order.changeCents).toBe(0);
    expect((await productRepo.getById(product.id))?.stockQuantity).toBe(3);
  });

  it('calcula el vuelto del pago en efectivo', async () => {
    const { productRepo, service } = setup();
    const product = await addProduct(productRepo);

    const result = await service.payNewOrder({ items: itemsWith(product, 1), customer: emptyCustomer, paymentMethod: 'cash', receivedCents: 1000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.subtotalCents).toBe(500);
    expect(result.order.changeCents).toBe(500);
  });

  it('cobra una orden pendiente y la marca como pagada', async () => {
    const { orderRepo, service, productRepo } = setup();
    const product = await addProduct(productRepo);
    const saved = await service.savePendingOrder({ items: itemsWith(product, 2), customer: emptyCustomer });
    if (!saved.ok) return;

    const paid = await service.payPendingOrder(saved.order.id, 'cash', 1000);
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.order.status).toBe('paid');
    expect(paid.order.paidAt).toBeDefined();
    const pending = await orderRepo.listPending();
    expect(pending).toHaveLength(0);
  });

  it('no permite cobrar dos veces la misma orden', async () => {
    const { service, productRepo } = setup();
    const product = await addProduct(productRepo);
    const saved = await service.savePendingOrder({ items: itemsWith(product, 2), customer: emptyCustomer });
    if (!saved.ok) return;

    const first = await service.payPendingOrder(saved.order.id, 'cash', 1000);
    const second = await service.payPendingOrder(saved.order.id, 'cash', 1000);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.message).toBe('Esta orden ya fue cobrada.');
  });

  it('no permite cobrar una orden ya anulada', async () => {
    const { service, productRepo } = setup();
    const product = await addProduct(productRepo);
    const saved = await service.savePendingOrder({ items: itemsWith(product, 2), customer: emptyCustomer });
    if (!saved.ok) return;
    await service.voidOrder(saved.order.id);

    const result = await service.payPendingOrder(saved.order.id, 'cash', 1000);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('Esta orden fue anulada y no se puede cobrar.');
  });

  it('cobra una orden pendiente sin revalidar stock que ya fue reservado al guardarla', async () => {
    const { service, productRepo } = setup();
    const product = await addProduct(productRepo);
    const saved = await service.savePendingOrder({ items: itemsWith(product, 5), customer: emptyCustomer });
    if (!saved.ok) return;
    expect((await productRepo.getById(product.id))?.stockQuantity).toBe(0);

    const result = await service.payPendingOrder(saved.order.id, 'cash', 5000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.status).toBe('paid');
  });

  it('cancela una orden pendiente y devuelve el stock', async () => {
    const { service, productRepo } = setup();
    const product = await addProduct(productRepo);
    const saved = await service.savePendingOrder({ items: itemsWith(product, 2), customer: emptyCustomer });
    if (!saved.ok) return;

    const result = await service.cancelPendingOrder(saved.order.id);
    expect(result.ok).toBe(true);
    expect((await productRepo.getById(product.id))?.stockQuantity).toBe(5);
  });

  it('cancela una orden pendiente sin devolver stock dos veces en un retry', async () => {
    const { service, productRepo } = setup();
    const product = await addProduct(productRepo);
    const saved = await service.savePendingOrder({ items: itemsWith(product, 2), customer: emptyCustomer });
    if (!saved.ok) return;

    const first = await service.cancelPendingOrder(saved.order.id);
    const second = await service.cancelPendingOrder(saved.order.id);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect((await productRepo.getById(product.id))?.stockQuantity).toBe(5);
  });

  it('anula una venta pagada, registra motivo y fecha, y devuelve el stock', async () => {
    const { service, productRepo } = setup();
    const product = await addProduct(productRepo);
    const paid = await service.payNewOrder({ items: itemsWith(product, 2), customer: emptyCustomer, paymentMethod: 'transfer' });
    if (!paid.ok) return;

    const voided = await service.voidOrder(paid.order.id, 'Cliente devolvió el producto');
    expect(voided.ok).toBe(true);
    if (!voided.ok) return;
    expect(voided.order.status).toBe('voided');
    expect(voided.order.voidedAt).toBeDefined();
    expect(voided.order.voidReason).toBe('Cliente devolvió el producto');
    expect((await productRepo.getById(product.id))?.stockQuantity).toBe(5);
  });

  it('usa "Anulación" como motivo por defecto al anular', async () => {
    const { service, productRepo } = setup();
    const product = await addProduct(productRepo);
    const paid = await service.payNewOrder({ items: itemsWith(product, 2), customer: emptyCustomer, paymentMethod: 'transfer' });
    if (!paid.ok) return;

    const voided = await service.voidOrder(paid.order.id);
    expect(voided.ok).toBe(true);
    if (!voided.ok) return;
    expect(voided.order.voidReason).toBe('Anulación');
  });

  it('una venta no puede anularse dos veces y el stock no se libera dos veces', async () => {
    const { service, productRepo } = setup();
    const product = await addProduct(productRepo);
    const paid = await service.payNewOrder({ items: itemsWith(product, 2), customer: emptyCustomer, paymentMethod: 'transfer' });
    if (!paid.ok) return;

    const first = await service.voidOrder(paid.order.id);
    const second = await service.voidOrder(paid.order.id);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.message).toBe('Esta venta ya fue anulada anteriormente.');
    expect((await productRepo.getById(product.id))?.stockQuantity).toBe(5);
  });

  it('permite anular una orden pendiente', async () => {
    const { service, productRepo } = setup();
    const product = await addProduct(productRepo);
    const saved = await service.savePendingOrder({ items: itemsWith(product, 2), customer: emptyCustomer });
    if (!saved.ok) return;

    const voided = await service.voidOrder(saved.order.id);
    expect(voided.ok).toBe(true);
    if (!voided.ok) return;
    expect(voided.order.status).toBe('voided');
    expect((await productRepo.getById(product.id))?.stockQuantity).toBe(5);
  });

  it('responde con error si la orden no existe', async () => {
    const { service } = setup();
    const result = await service.payPendingOrder('no-existe', 'cash', 1000);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('La orden ya no existe.');
  });

  it('no permite eliminar una orden pagada', async () => {
    const { service, productRepo } = setup();
    const product = await addProduct(productRepo);
    const paid = await service.payNewOrder({ items: itemsWith(product, 2), customer: emptyCustomer, paymentMethod: 'transfer' });
    if (!paid.ok) return;

    const result = await service.cancelPendingOrder(paid.order.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe('Solo se pueden eliminar órdenes pendientes.');
  });

  it('mantiene el stock reservado de una orden pagada', async () => {
    const { service, productRepo } = setup();
    const product = await addProduct(productRepo);
    await service.payNewOrder({ items: itemsWith(product, 2), customer: emptyCustomer, paymentMethod: 'transfer' });

    expect((await productRepo.getById(product.id))?.stockQuantity).toBe(3);
  });
});