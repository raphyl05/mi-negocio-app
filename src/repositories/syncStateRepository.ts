import { Platform } from 'react-native';
import type { SyncState, SyncStateInput } from '../models/syncState';
import { createSqliteSyncStateRepository } from './sqliteSyncStateRepository';

export interface SyncStateRepository {
  get(): Promise<SyncState | null>;
  save(state: SyncStateInput): Promise<SyncState>;
}

export function createInMemorySyncStateRepository(): SyncStateRepository {
  let state: SyncState | null = null;

  return {
    async get() {
      return state ? { ...state } : null;
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
      state = saved;
      return { ...saved };
    },
  };
}

class LazySyncStateRepository implements SyncStateRepository {
  private implPromise: Promise<SyncStateRepository> | null = null;

  reset(): void {
    this.implPromise = null;
  }

  private ready(): Promise<SyncStateRepository> {
    if (!this.implPromise) {
      this.implPromise =
        Platform.OS === 'web'
          ? Promise.resolve(createInMemorySyncStateRepository())
          : createSqliteSyncStateRepository();
    }
    return this.implPromise;
  }

  async get() {
    return (await this.ready()).get();
  }

  async save(state: SyncStateInput) {
    return (await this.ready()).save(state);
  }
}

export const syncStateRepository: SyncStateRepository = new LazySyncStateRepository();

export function resetSyncStateRepository(): void {
  (syncStateRepository as LazySyncStateRepository).reset();
}