import type { Product } from '../models/product';

export interface ProductRepository {
  list(): Promise<Product[]>;
  listByCategory(category: string): Promise<Product[]>;
}

const SEED_PRODUCTS: Product[] = [
  buildSeed('hamburguesa', 'Hamburguesa', 25000, 'Comidas', '🍔'),
  buildSeed('hotdog', 'Hot dog', 12000, 'Comidas', '🌭'),
  buildSeed('pollo-frito', 'Pollo frito', 15000, 'Comidas', '🍗'),
  buildSeed('sandwich', 'Sándwich', 18000, 'Comidas', '🥪'),
  buildSeed('arroz-habichuelas', 'Arroz con habichuelas', 18000, 'Comidas', '🍚'),
  buildSeed('papas-fritas', 'Papas fritas', 10000, 'Comidas', '🍟'),
  buildSeed('refresco', 'Refresco', 10000, 'Bebidas', '🥤'),
  buildSeed('jugo-natural', 'Jugo natural', 12000, 'Bebidas', '🧃'),
  buildSeed('batido', 'Batido', 14000, 'Bebidas', '🥛'),
  buildSeed('cafe', 'Café', 6000, 'Bebidas', '🍵'),
  buildSeed('flan', 'Flan', 8000, 'Postres', '🍮'),
  buildSeed('helado', 'Helado', 10000, 'Postres', '🍨'),
];

function buildSeed(id: string, name: string, priceCents: number, category: string, emoji: string): Product {
  return { id, name, priceCents, category, emoji, active: true, createdAt: '2026-01-01T00:00:00.000Z' };
}

class InMemoryProductRepository implements ProductRepository {
  private products: Product[] = SEED_PRODUCTS;

  async list(): Promise<Product[]> {
    return this.products;
  }

  async listByCategory(category: string): Promise<Product[]> {
    return this.products.filter((product) => product.category === category);
  }
}

export const productRepository: ProductRepository = new InMemoryProductRepository();