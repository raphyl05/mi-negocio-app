import type { StockMovementType } from '../models/stockMovement';
import { productRepository } from '../repositories/productRepository';
import type { ProductRepository } from '../repositories/productRepository';
import { stockMovementRepository } from '../repositories/stockMovementRepository';
import type { StockMovementRepository } from '../repositories/stockMovementRepository';
import { withTransaction } from '../repositories/transaction';
import type { CartItem } from '../utils/cart';

export type StockChangeCtx = {
  movementRepo?: StockMovementRepository;
  referenceId?: string;
  movementType?: StockMovementType;
};

export async function reserveOrderStock(
  items: CartItem[],
  repo: ProductRepository = productRepository,
  ctx?: StockChangeCtx,
): Promise<void> {
  for (const item of items) {
    await repo.decreaseStock(item.product.id, item.quantity);
    if (ctx?.movementRepo) {
      await ctx.movementRepo.recordMovement({
        productId: item.product.id,
        quantity: -item.quantity,
        movementType: ctx.movementType ?? 'SALE',
        referenceId: ctx.referenceId,
      });
    }
  }
}

export async function releaseOrderStock(
  items: CartItem[],
  repo: ProductRepository = productRepository,
  ctx?: StockChangeCtx,
): Promise<void> {
  for (const item of items) {
    await repo.adjustStock(item.product.id, item.quantity);
    if (ctx?.movementRepo) {
      await ctx.movementRepo.recordMovement({
        productId: item.product.id,
        quantity: item.quantity,
        movementType: ctx.movementType ?? 'RETURN',
        referenceId: ctx.referenceId,
      });
    }
  }
}

export type AdjustStockDeps = {
  repo?: ProductRepository;
  movementRepo?: StockMovementRepository;
  withTransaction?: <T>(fn: () => Promise<T>) => Promise<T>;
};

export async function adjustStockWithMovement(
  productId: string,
  delta: number,
  movementType: StockMovementType = 'ADJUSTMENT',
  referenceId?: string,
  deps: AdjustStockDeps = {},
): Promise<void> {
  const run = deps.withTransaction ?? withTransaction;
  await run(async () => {
    const repo = deps.repo ?? productRepository;
    await repo.adjustStock(productId, delta);
    const movementRepo = deps.movementRepo ?? stockMovementRepository;
    await movementRepo.recordMovement({ productId, quantity: delta, movementType, referenceId });
  });
}