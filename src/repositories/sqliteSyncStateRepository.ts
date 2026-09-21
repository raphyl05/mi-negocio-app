import type { SyncStateRepository } from './syncStateRepository';
import { createInMemorySyncStateRepository } from './syncStateRepository';

export async function createSqliteSyncStateRepository(): Promise<SyncStateRepository> {
  return createInMemorySyncStateRepository();
}