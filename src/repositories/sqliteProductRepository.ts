import type { ProductRepository } from './productRepository';
import { createInMemoryProductRepository } from './productRepository';

export async function createSqliteProductRepository(): Promise<ProductRepository> {
  return createInMemoryProductRepository();
}