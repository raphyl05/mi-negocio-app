import type { SyncState, SyncStatus } from '../models/syncState';
import { syncStateRepository } from '../repositories/syncStateRepository';
import { getDeviceId } from '../utils/syncIdentity';

const now = (): string => new Date().toISOString();

export async function ensureSyncState(businessId: string): Promise<SyncState> {
  const existing = await syncStateRepository.get();
  if (existing && existing.businessId === businessId) return existing;
  if (existing && existing.businessId !== businessId) {
    const refreshed: SyncState = { ...existing, businessId, updatedAt: now() };
    return syncStateRepository.save(refreshed);
  }
  const deviceId = await getDeviceId();
  return syncStateRepository.save({
    deviceId,
    businessId,
    status: 'idle',
    updatedAt: now(),
  });
}

export async function touchSyncState(input: {
  status?: SyncStatus;
  lastSyncAt?: string;
  lastServerCursor?: string;
}): Promise<SyncState | null> {
  const existing = await syncStateRepository.get();
  if (!existing) return null;
  return syncStateRepository.save({
    ...existing,
    lastSyncAt: input.lastSyncAt ?? existing.lastSyncAt,
    lastServerCursor: input.lastServerCursor ?? existing.lastServerCursor,
    status: input.status ?? existing.status,
    updatedAt: now(),
  });
}