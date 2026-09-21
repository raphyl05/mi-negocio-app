import { Platform } from 'react-native';
import type { StockMovement, StockMovementInput } from '../models/stockMovement';
import { generateId } from '../utils/password';
import { createSqliteStockMovementRepository } from './sqliteStockMovementRepository';

export interface StockMovementRepository {
  recordMovement(input: StockMovementInput): Promise<StockMovement>;
  listByProduct(productId: string): Promise<StockMovement[]>;
  listPending(): Promise<StockMovement[]>;
  listAll(): Promise<StockMovement[]>;
  markSynced(ids: string[]): Promise<void>;
}

export function createInMemoryStockMovementRepository(): StockMovementRepository {
  let movements: StockMovement[] = [];

  return {
    async recordMovement(input) {
      const movement: StockMovement = {
        id: input.id ?? generateId(),
        productId: input.productId,
        quantity: input.quantity,
        movementType: input.movementType,
        referenceId: input.referenceId,
        deviceId: input.deviceId,
        createdAt: input.createdAt ?? new Date().toISOString(),
        synced: input.synced ?? false,
      };
      movements = [...movements, movement];
      return movement;
    },

    async listByProduct(productId) {
      return movements
        .filter((movement) => movement.productId === productId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async listPending() {
      return movements
        .filter((movement) => !movement.synced)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async listAll() {
      return [...movements].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async markSynced(ids) {
      const idSet = new Set(ids);
      movements = movements.map((movement) =>
        idSet.has(movement.id) ? { ...movement, synced: true } : movement,
      );
    },
  };
}

class LazyStockMovementRepository implements StockMovementRepository {
  private implPromise: Promise<StockMovementRepository> | null = null;

  reset(): void {
    this.implPromise = null;
  }

  private ready(): Promise<StockMovementRepository> {
    if (!this.implPromise) {
      this.implPromise =
        Platform.OS === 'web'
          ? Promise.resolve(createInMemoryStockMovementRepository())
          : createSqliteStockMovementRepository();
    }
    return this.implPromise;
  }

  async recordMovement(input: StockMovementInput) {
    return (await this.ready()).recordMovement(input);
  }

  async listByProduct(productId: string) {
    return (await this.ready()).listByProduct(productId);
  }

  async listPending() {
    return (await this.ready()).listPending();
  }

  async listAll() {
    return (await this.ready()).listAll();
  }

  async markSynced(ids: string[]) {
    return (await this.ready()).markSynced(ids);
  }
}

export const stockMovementRepository: StockMovementRepository = new LazyStockMovementRepository();

export function resetStockMovementRepository(): void {
  (stockMovementRepository as LazyStockMovementRepository).reset();
}