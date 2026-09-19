import { Platform } from 'react-native';
import type { Product } from '../models/product';
import { SEED_PRODUCTS } from '../data/seedProducts';
import { generateId } from '../utils/password';
import { createSqliteProductRepository } from './sqliteProductRepository';

export interface ProductRepository {
  list(): Promise<Product[]>;
  listByCategory(category: string): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  create(product: Product): Promise<Product>;
  update(product: Product): Promise<Product>;
  remove(id: string): Promise<void>;
  removeByCategory(category: string): Promise<number>;
  decreaseStock(id: string, quantity: number): Promise<void>;
  adjustStock(id: string, delta: number): Promise<Product | null>;
  renameCategory(oldName: string, newName: string): Promise<number>;
}

export function createInMemoryProductRepository(): ProductRepository {
  let products: Product[] = SEED_PRODUCTS;

  return {
    async list() {
      return [...products];
    },

    async listByCategory(category) {
      return products.filter((product) => product.category === category);
    },

    async getById(id) {
      return products.find((product) => product.id === id) ?? null;
    },

    async create(product) {
      const created: Product = { ...product, id: product.id || generateId() };
      products = [...products, created];
      return created;
    },

    async update(product) {
      products = products.map((existing) => (existing.id === product.id ? product : existing));
      return product;
    },

    async remove(id) {
      products = products.filter((product) => product.id !== id);
    },

    async removeByCategory(category) {
      const before = products.length;
      products = products.filter((product) => product.category !== category);
      return before - products.length;
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
      let renamed = 0;
      products = products.map((product) => {
        if (product.category !== oldName) return product;
        renamed += 1;
        return { ...product, category: newName };
      });
      return renamed;
    },
  };
}

class LazyProductRepository implements ProductRepository {
  private implPromise: Promise<ProductRepository> | null = null;

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

  async getById(id: string) {
    return (await this.ready()).getById(id);
  }

  async create(product: Product) {
    return (await this.ready()).create(product);
  }

  async update(product: Product) {
    return (await this.ready()).update(product);
  }

  async remove(id: string) {
    return (await this.ready()).remove(id);
  }

  async removeByCategory(category: string) {
    return (await this.ready()).removeByCategory(category);
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