import { createInMemoryProductRepository } from '../src/repositories/productRepository';
import type { Product } from '../src/models/product';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '',
    name: 'Nuevo',
    priceCents: 10000,
    category: 'Pruebas',
    imageType: 'emoji',
    emoji: '🍽️',
    trackStock: false,
    stockQuantity: 0,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('productRepository (en memoria)', () => {
  it('crea un producto asignándole un id', async () => {
    const repo = createInMemoryProductRepository();
    const created = await repo.create(makeProduct());
    expect(created.id).toBeTruthy();
    expect(await repo.getById(created.id)).not.toBeNull();
  });

  it('actualiza un producto existente', async () => {
    const repo = createInMemoryProductRepository();
    const created = await repo.create(makeProduct());
    const updated = { ...created, name: 'Renombrado', priceCents: 12500 };
    await repo.update(updated);
    const found = await repo.getById(created.id);
    expect(found?.name).toBe('Renombrado');
    expect(found?.priceCents).toBe(12500);
  });

  it('elimina un producto', async () => {
    const repo = createInMemoryProductRepository();
    const created = await repo.create(makeProduct());
    await repo.remove(created.id);
    expect(await repo.getById(created.id)).toBeNull();
  });

  it('descuenta stock sin pasar de cero', async () => {
    const repo = createInMemoryProductRepository();
    const created = await repo.create(makeProduct({ trackStock: true, stockQuantity: 5 }));
    await repo.decreaseStock(created.id, 3);
    expect((await repo.getById(created.id))?.stockQuantity).toBe(2);
    await repo.decreaseStock(created.id, 10);
    expect((await repo.getById(created.id))?.stockQuantity).toBe(0);
  });

  it('no descuenta stock de productos sin control', async () => {
    const repo = createInMemoryProductRepository();
    const created = await repo.create(makeProduct({ trackStock: false, stockQuantity: 0 }));
    await repo.decreaseStock(created.id, 2);
    expect((await repo.getById(created.id))?.stockQuantity).toBe(0);
  });

  it('filtra por categoría y lista todo', async () => {
    const repo = createInMemoryProductRepository();
    await repo.create(makeProduct({ name: 'Comida A', category: 'Comidas' }));
    await repo.create(makeProduct({ name: 'Bebida B', category: 'Bebidas' }));
    const comidas = await repo.listByCategory('Comidas');
    expect(comidas.some((p) => p.name === 'Comida A')).toBe(true);
    expect(comidas.some((p) => p.name === 'Bebida B')).toBe(false);
    expect((await repo.list()).length).toBeGreaterThanOrEqual(2);
  });
});