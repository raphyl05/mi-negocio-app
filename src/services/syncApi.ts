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

export type PushRequest = {
  requestId?: string;
  opType: 'initial' | 'incremental';
  batches: Array<{
    entityType: string;
    id: string;
    entity: Record<string, unknown>;
  }>;
};

export type PushResponse = {
  requestId: string;
  applied: boolean;
  duplicate: boolean;
  seq: number;
  accepted: number;
  rejected: number;
};

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

export async function syncPushBatch(
  businessId: string,
  opType: 'initial' | 'incremental',
  entityType: string,
  id: string,
  entity: Record<string, unknown>
): Promise<{ ok: boolean; data?: PushResponse; error?: { code: string; message: string } }> {
  return syncPush(businessId, {
    requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    opType,
    batches: [{ entityType, id, entity }],
  });
}
