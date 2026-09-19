import { createInMemoryProductRepository } from '../src/repositories/productRepository';
import { reserveOrderStock, releaseOrderStock } from '../src/services/stockService';
import type { Product } from '../src/models/product';
import type { CartItem } from '../src/utils/cart';

const product: Product = {
  id: 'p1',
  name: 'Hamburguesa',
  priceCents: 25000,
  category: 'Comidas',
  imageType: 'emoji',
  emoji: '🍔',
  stockQuantity: 10,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('stockService', () => {
  it('reserva stock (descuenta) al guardar y lo devuelve al liberar', async () => {
    const repo = createInMemoryProductRepository();
    await repo.create(product);

    const items: CartItem[] = [{ product, quantity: 3 }];
    await reserveOrderStock(items, repo);
    expect((await repo.getById('p1'))?.stockQuantity).toBe(7);

    await releaseOrderStock(items, repo);
    expect((await repo.getById('p1'))?.stockQuantity).toBe(10);
  });

  it('no deja el stock por debajo de cero al reservar', async () => {
    const lowStock = { ...product, stockQuantity: 2 };
    const repo = createInMemoryProductRepository();
    await repo.create(lowStock);

    await reserveOrderStock([{ product: lowStock, quantity: 5 }], repo);
    expect((await repo.getById('p1'))?.stockQuantity).toBe(0);
  });
});