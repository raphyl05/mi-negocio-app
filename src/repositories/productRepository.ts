import { Platform } from 'react-native';
import type { Product } from '../models/product';
import { SEED_PRODUCTS } from '../data/seedProducts';
import { generateId } from '../utils/password';
import { enqueueSyncChange } from '../services/syncChangeQueue';
import { createSqliteProductRepository } from './sqliteProductRepository';

export interface ProductRepository {
  list(): Promise<Product[]>;
  listByCategory(category: string): Promise<Product[]>;
  listIncludingDeleted(): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  create(product: Product): Promise<Product>;
  update(product: Product): Promise<Product>;
  remove(id: string): Promise<void>;
  hardRemove(id: string): Promise<void>;
  removeByCategory(category: string): Promise<number>;
  decreaseStock(id: string, quantity: number): Promise<void>;
  adjustStock(id: string, delta: number): Promise<Product | null>;
  renameCategory(oldName: string, newName: string): Promise<number>;
}

export function createInMemoryProductRepository(): ProductRepository {
  let products: Product[] = SEED_PRODUCTS;

  const now = (): string => new Date().toISOString();

  return {
    async list() {
      return products.filter((product) => !product.deletedAt);
    },

    async listByCategory(category) {
      return products.filter((product) => product.category === category && !product.deletedAt);
    },

    async listIncludingDeleted() {
      return [...products];
    },

    async getById(id) {
      const product = products.find((p) => p.id === id && !p.deletedAt);
      return product ?? null;
    },

    async create(product) {
      const created: Product = {
        ...product,
        id: product.id || generateId(),
        updatedAt: product.updatedAt ?? product.createdAt ?? now(),
      };
      products = [...products, created];
      return created;
    },

    async update(product) {
      const updated: Product = { ...product, updatedAt: now() };
      products = products.map((existing) =>
        existing.id === product.id && !existing.deletedAt ? updated : existing,
      );
      return updated;
    },

    async remove(id) {
      const stamped = now();
      products = products.map((product) =>
        product.id === id && !product.deletedAt
          ? { ...product, deletedAt: stamped, updatedAt: stamped }
          : product,
      );
    },

    async hardRemove(id) {
      products = products.filter((product) => product.id !== id);
    },

    async removeByCategory(category) {
      const stamped = now();
      const before = products.filter((product) => product.category === category && !product.deletedAt)
        .length;
      products = products.map((product) =>
        product.category === category && !product.deletedAt
          ? { ...product, deletedAt: stamped, updatedAt: stamped }
          : product,
      );
      return before;
    },

    async decreaseStock(id, quantity) {
      products = products.map((product) =>
        product.id === id
          ? { ...product, stockQuantity: Math.max(0, product.stockQuantity - quantity) }
          : product,
      );
    },

    async adjustStock(id, delta) {
      let updated: Product | null = null;
      products = products.map((product) => {
        if (product.id !== id) return product;
        updated = { ...product, stockQuantity: Math.max(0, product.stockQuantity + delta) };
        return updated;
      });
      return updated;
    },

    async renameCategory(oldName, newName) {
      const stamped = now();
      let renamed = 0;
      products = products.map((product) => {
        if (product.category !== oldName || product.deletedAt) return product;
        renamed += 1;
        return { ...product, category: newName, updatedAt: stamped };
      });
      return renamed;
    },
  };
}

class LazyProductRepository implements ProductRepository {
  private implPromise: Promise<ProductRepository> | null = null;

  reset(): void {
    this.implPromise = null;
  }

  private ready(): Promise<ProductRepository> {
    if (!this.implPromise) {
      this.implPromise =
        Platform.OS === 'web'
          ? Promise.resolve(createInMemoryProductRepository())
          : createSqliteProductRepository();
    }
    return this.implPromise;
  }

  async list() {
    return (await this.ready()).list();
  }

  async listByCategory(category: string) {
    return (await this.ready()).listByCategory(category);
  }

  async listIncludingDeleted() {
    return (await this.ready()).listIncludingDeleted();
  }

  async getById(id: string) {
    return (await this.ready()).getById(id);
  }

  async create(product: Product) {
    const created = await (await this.ready()).create(product);
    await enqueueSyncChange('product', created.id, 'upsert');
    return created;
  }

  async update(product: Product) {
    const updated = await (await this.ready()).update(product);
    await enqueueSyncChange('product', updated.id, 'upsert');
    return updated;
  }

  async remove(id: string) {
    await (await this.ready()).remove(id);
    await enqueueSyncChange('product', id, 'delete');
  }

  async hardRemove(id: string) {
    await (await this.ready()).hardRemove(id);
    await enqueueSyncChange('product', id, 'delete');
  }

  async removeByCategory(category: string) {
    const impl = await this.ready();
    const affected = (await impl.listIncludingDeleted())
      .filter((p) => p.category === category && !p.deletedAt);
    const count = await impl.removeByCategory(category);
    for (const p of affected) await enqueueSyncChange('product', p.id, 'delete');
    return count;
  }

  async decreaseStock(id: string, quantity: number) {
    return (await this.ready()).decreaseStock(id, quantity);
  }

  async adjustStock(id: string, delta: number) {
    return (await this.ready()).adjustStock(id, delta);
  }

  async renameCategory(oldName: string, newName: string) {
    return (await this.ready()).renameCategory(oldName, newName);
  }
}

export const productRepository: ProductRepository = new LazyProductRepository();

// Descarta la implementación cacheada; la próxima llamada recrea el repo
// (y, en nativo, reabre la BD sembrada si el archivo fue borrado).
export function resetProductRepository(): void {
  (productRepository as LazyProductRepository).reset();
}