import type { StockMovement, StockMovementInput } from '../models/stockMovement';
import { generateId } from '../utils/password';
import { getDatabase } from './database.native';
import type { StockMovementRepository } from './stockMovementRepository';

type MovementRow = {
  id: string;
  productId: string;
  quantity: number;
  movementType: StockMovement['movementType'];
  referenceId: string | null;
  deviceId: string | null;
  synced: number;
  createdAt: string;
};

function rowToMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.productId,
    quantity: row.quantity,
    movementType: row.movementType,
    referenceId: row.referenceId ?? undefined,
    deviceId: row.deviceId ?? undefined,
    synced: row.synced === 1,
    createdAt: row.createdAt,
  };
}

export async function createSqliteStockMovementRepository(): Promise<StockMovementRepository> {
  const db = await getDatabase();

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
      await db.runAsync(
        `INSERT INTO stock_movements (id, productId, quantity, movementType, referenceId, deviceId, synced, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movement.id,
          movement.productId,
          movement.quantity,
          movement.movementType,
          movement.referenceId ?? null,
          movement.deviceId ?? null,
          movement.synced ? 1 : 0,
          movement.createdAt,
        ],
      );
      return movement;
    },

    async listByProduct(productId) {
      const rows = await db.getAllAsync<MovementRow>(
        'SELECT * FROM stock_movements WHERE productId = ? ORDER BY createdAt ASC',
        productId,
      );
      return rows.map(rowToMovement);
    },

    async listPending() {
      const rows = await db.getAllAsync<MovementRow>(
        'SELECT * FROM stock_movements WHERE synced = 0 ORDER BY createdAt ASC',
      );
      return rows.map(rowToMovement);
    },

    async listAll() {
      const rows = await db.getAllAsync<MovementRow>(
        'SELECT * FROM stock_movements ORDER BY createdAt ASC',
      );
      return rows.map(rowToMovement);
    },

    async markSynced(ids) {
      if (ids.length === 0) return;
      for (const id of ids) {
        await db.runAsync('UPDATE stock_movements SET synced = 1 WHERE id = ?', id);
      }
    },
  };
}