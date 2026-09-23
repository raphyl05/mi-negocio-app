import { apiFetch } from './authApi';
import { getDeviceId } from '../utils/syncIdentity';

export type PullResponse = {
  cursor: string;
  nextCursor: string | null;
  hasMore: boolean;
  serverTime: string;
  changes: {
    business: unknown[];
    products: unknown[];
    customers: unknown[];
    providers: unknown[];
    orders: unknown[];
    stockMovements: unknown[];
    cashClosures: unknown[];
  };
};

export type SyncAction = 'upsert' | 'delete';

export type PushBatch = {
  entityType: string;
  action: SyncAction;
  id: string;
  entity: Record<string, unknown>;
};

export type PushRequest = {
  requestId?: string;
  opType: 'initial' | 'incremental';
  batches: PushBatch[];
};

export type PushResponse = {
  requestId: string;
  applied: boolean;
  duplicate: boolean;
  seq: number;
  accepted: number;
  rejected: number;
};

export type DeviceRole = 'admin' | 'cashier' | 'waiter' | 'kitchen' | 'printer';

export async function syncPull(
  businessId: string,
  since?: string
): Promise<{ ok: boolean; data?: PullResponse; error?: { code: string; message: string } }> {
  const path = `/businesses/${businessId}/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`;
  const res = await apiFetch<PullResponse>(path);
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function syncPush(
  businessId: string,
  req: PushRequest
): Promise<{ ok: boolean; data?: PushResponse; error?: { code: string; message: string } }> {
  const res = await apiFetch<PushResponse>(`/businesses/${businessId}/sync/push`, {
    method: 'POST',
    body: req,
  });
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiRegisterDevice(
  businessId: string,
  role: DeviceRole,
): Promise<{ ok: boolean; data?: { id: string; businessId: string; deviceId: string; role: string }; error?: { code: string; message: string } }> {
  const deviceId = await getDeviceId();
  const res = await apiFetch<{ id: string; businessId: string; deviceId: string; role: string }>(
    '/devices',
    {
      method: 'POST',
      body: { deviceId, businessId, role },
    },
  );
  return { ok: !!res.data, data: res.data, error: res.error };
}