import type { Product } from '../models/product';
import { generateId } from '../utils/password';

export interface ProductRepository {
  list(): Promise<Product[]>;
  listByCategory(category: string): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  create(product: Product): Promise<Product>;
  update(product: Product): Promise<Product>;
  remove(id: string): Promise<void>;
  decreaseStock(id: string, quantity: number): Promise<void>;
}

const SEED_PRODUCTS: Product[] = [
  buildSeed('hamburguesa', 'Hamburguesa', 25000, 'Comidas', '🍔', true, 50),
  buildSeed('hotdog', 'Hot dog', 12000, 'Comidas', '🌭', false, 0),
  buildSeed('pollo-frito', 'Pollo frito', 15000, 'Comidas', '🍗', false, 0),
  buildSeed('sandwich', 'Sándwich', 18000, 'Comidas', '🥪', true, 20),
  buildSeed('arroz-habichuelas', 'Arroz con habichuelas', 18000, 'Comidas', '🍚', false, 0),
  buildSeed('papas-fritas', 'Papas fritas', 10000, 'Comidas', '🍟', false, 0),
  buildSeed('refresco', 'Refresco', 10000, 'Bebidas', '🥤', true, 100),
  buildSeed('jugo-natural', 'Jugo natural', 12000, 'Bebidas', '🧃', false, 0),
  buildSeed('batido', 'Batido', 14000, 'Bebidas', '🥛', false, 0),
  buildSeed('cafe', 'Café', 6000, 'Bebidas', '🍵', false, 0),
  buildSeed('flan', 'Flan', 8000, 'Postres', '🍮', false, 0),
  buildSeed('helado', 'Helado', 10000, 'Postres', '🍨', true, 30),
];

function buildSeed(
  id: string,
  name: string,
  priceCents: number,
  category: string,
  emoji: string,
  trackStock: boolean,
  stockQuantity: number,
): Product {
  return {
    id,
    name,
    priceCents,
    category,
    imageType: 'emoji',
    emoji,
    trackStock,
    stockQuantity,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
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

    async decreaseStock(id, quantity) {
      products = products.map((product) =>
        product.id === id
          ? { ...product, stockQuantity: Math.max(0, product.stockQuantity - quantity) }
          : product,
      );
    },
  };
}

export const productRepository: ProductRepository = createInMemoryProductRepository();