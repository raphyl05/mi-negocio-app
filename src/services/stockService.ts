import { productRepository } from '../repositories/productRepository';
import type { ProductRepository } from '../repositories/productRepository';
import type { CartItem } from '../utils/cart';

export async function reserveOrderStock(
  items: CartItem[],
  repo: ProductRepository = productRepository,
): Promise<void> {
  for (const item of items) {
    await repo.decreaseStock(item.product.id, item.quantity);
  }
}

export async function releaseOrderStock(
  items: CartItem[],
  repo: ProductRepository = productRepository,
): Promise<void> {
  for (const item of items) {
    await repo.adjustStock(item.product.id, item.quantity);
  }
}