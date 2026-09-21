import type { SyncState, SyncStateInput } from '../models/syncState';
import { getDatabase } from './database.native';
import type { SyncStateRepository } from './syncStateRepository';

type SyncStateRow = {
  id: string;
  deviceId: string;
  businessId: string;
  lastSyncAt: string | null;
  lastServerCursor: string | null;
  status: SyncState['status'];
  updatedAt: string;
};

function rowToSyncState(row: SyncStateRow): SyncState {
  return {
    id: row.id,
    deviceId: row.deviceId,
    businessId: row.businessId,
    lastSyncAt: row.lastSyncAt ?? undefined,
    lastServerCursor: row.lastServerCursor ?? undefined,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

export async function createSqliteSyncStateRepository(): Promise<SyncStateRepository> {
  const db = await getDatabase();

  return {
    async get() {
      const row = await db.getFirstAsync<SyncStateRow>('SELECT * FROM sync_state LIMIT 1');
      return row ? rowToSyncState(row) : null;
    },

    async save(input) {
      const saved: SyncState = {
        id: input.id ?? 'sync-state',
        deviceId: input.deviceId,
        businessId: input.businessId,
        lastSyncAt: input.lastSyncAt,
        lastServerCursor: input.lastServerCursor,
        status: input.status,
        updatedAt: input.updatedAt,
      };
      await db.runAsync(
        `INSERT INTO sync_state (id, deviceId, businessId, lastSyncAt, lastServerCursor, status, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           deviceId = excluded.deviceId,
           businessId = excluded.businessId,
           lastSyncAt = excluded.lastSyncAt,
           lastServerCursor = excluded.lastServerCursor,
           status = excluded.status,
           updatedAt = excluded.updatedAt`,
        [
          saved.id,
          saved.deviceId,
          saved.businessId,
          saved.lastSyncAt ?? null,
          saved.lastServerCursor ?? null,
          saved.status,
          saved.updatedAt,
        ],
      );
      return saved;
    },
  };
}