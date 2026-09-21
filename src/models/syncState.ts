export type SyncStatus = 'idle' | 'syncing' | 'error';

export type SyncState = {
  id: string;
  deviceId: string;
  businessId: string;
  lastSyncAt?: string;
  lastServerCursor?: string;
  status: SyncStatus;
  updatedAt: string;
};

export type SyncStateInput = Omit<SyncState, 'id'> & { id?: string };