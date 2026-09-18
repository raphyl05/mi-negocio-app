import type { OrderRepository } from './orderRepository';
import { createInMemoryOrderRepository } from './orderRepository';

export async function createSqliteOrderRepository(): Promise<OrderRepository> {
  return createInMemoryOrderRepository();
}