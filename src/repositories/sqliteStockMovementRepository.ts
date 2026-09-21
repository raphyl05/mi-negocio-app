import type { StockMovementRepository } from './stockMovementRepository';
import { createInMemoryStockMovementRepository } from './stockMovementRepository';

export async function createSqliteStockMovementRepository(): Promise<StockMovementRepository> {
  return createInMemoryStockMovementRepository();
}