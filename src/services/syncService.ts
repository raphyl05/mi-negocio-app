import { getBusiness } from './setupService';
import { productRepository } from '../repositories/productRepository';
import { customerRepository } from '../repositories/customerRepository';
import { providerRepository } from '../repositories/providerRepository';
import { orderRepository } from '../repositories/orderRepository';
import { stockMovementRepository } from '../repositories/stockMovementRepository';
import { listCashClosures, upsertCashClosureRecord } from './cashRegisterService';
import { syncPull, syncPush, apiRegisterDevice, type PushBatch as ApiPushBatch } from './syncApi';
import { syncStateRepository } from '../repositories/syncStateRepository';
import { ensureSyncState, touchSyncState } from './syncStateService';
import {
  countSyncChanges,
  dequeueSyncChanges,
  listSyncChanges,
  clearSyncChanges,
  setSyncTrackingEnabled,
  type SyncChange,
} from './syncChangeQueue';
import {
  buildBusinessBatch,
  buildCashClosureBatch,
  buildNamedBatch,
  buildOrderBatch,
  buildProductBatch,
  buildStockMovementBatch,
  cashClosureFromServer,
  customerFromServer,
  deletedAtOf,
  namedPatchFromServer,
  orderFromServer,
  productFromServer,
  productPatchFromServer,
  providerFromServer,
  toStockMovementInput,
  type PushBatch,
  type ServerCashClosureDto,
  type ServerNamedDto,
  type ServerOrderDto,
  type ServerProductDto,
  type ServerStockMovementDto,
} from '../utils/syncMapper';

const SYNC_MAX_RETRIES = 3;
const SYNC_BASE_DELAY = 1000;

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = SYNC_MAX_RETRIES): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries) break;
      const delay = SYNC_BASE_DELAY * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

const SYNC_REQUEST_KEYS = '@vendelo/syncRequestKeys';

async function getSyncRequestKeys(): Promise<string[]> {
  try {
    const raw = await AsyncStorageGet(SYNC_REQUEST_KEYS);
    return raw ? JSON.parse(raw) as string[] : [];
  } catch { return []; }
}

async function addSyncRequestKey(key: string): Promise<void> {
  const keys = await getSyncRequestKeys();
  if (!keys.includes(key)) {
    keys.push(key);
    await AsyncStorageSet(SYNC_REQUEST_KEYS, JSON.stringify(keys));
  }
}

async function isDuplicateRequest(key: string): Promise<boolean> {
  const keys = await getSyncRequestKeys();
  return keys.includes(key);
}

async function AsyncStorageGet(key: string): Promise<string | null> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  return AsyncStorage.getItem(key);
}

async function AsyncStorageSet(key: string, value: string): Promise<void> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  await AsyncStorage.setItem(key, value);
}

export type SyncDirection = 'pull' | 'push' | 'full';

export type SyncResult = {
  direction: SyncDirection;
  pulled: number;
  pushed: number;
  errors: string[];
  cursor?: string;
};

type PendingBatch = {
  batch: PushBatch;
  dequeueKey: string;
  movementId?: string;
};

const CHUNK_SIZE = 50;

async function enqueueForSync(businessId: string): Promise<PendingBatch[]> {
  const pending: PendingBatch[] = [];
  const business = await getBusiness();
  if (business) pending.push({ batch: buildBusinessBatch(business), dequeueKey: `business:${business.id ?? business.name}` });

  const changes = await listSyncChanges();
  for (const c of changes) {
    if (c.entityType === 'business') continue;
    const built = await buildBatchFromChange(c);
    if (built) pending.push(built);
    else await dequeueSyncChanges([c.key]);
  }
  return pending;
}

async function buildBatchFromChange(c: SyncChange): Promise<PendingBatch | null> {
  const dequeueKey = c.key;
  switch (c.entityType) {
    case 'product': {
      const p = await productRepository.getById(c.entityId);
      if (!p) return null;
      return { batch: buildProductBatch(p, c.action), dequeueKey };
    }
    case 'customer': {
      const cus = await customerRepository.getById(c.entityId);
      if (!cus) return null;
      return { batch: buildNamedBatch('customer', cus, c.action), dequeueKey };
    }
    case 'provider': {
      const prov = await providerRepository.getById(c.entityId);
      if (!prov) return null;
      return { batch: buildNamedBatch('provider', prov, c.action), dequeueKey };
    }
    case 'order': {
      const o = await orderRepository.getById(c.entityId);
      if (!o) return null;
      return { batch: buildOrderBatch(o, c.action), dequeueKey };
    }
    case 'stockMovement': {
      const found = await stockMovementRepository.listAll();
      const m = found.find((x) => x.id === c.entityId);
      if (!m) return null;
      return { batch: buildStockMovementBatch(m), dequeueKey, movementId: m.id };
    }
    case 'cashClosure': {
      const closures = await listCashClosures();
      const cl = closures.find((x) => x.id === c.entityId);
      if (!cl) return null;
      return { batch: buildCashClosureBatch(cl), dequeueKey };
    }
    default:
      return null;
  }
}

async function pushPending(pending: PendingBatch[], businessId: string, errors: string[]): Promise<number> {
  let pushed = 0;
  const byType = new Map<string, PendingBatch[]>();
  for (const p of pending) {
    const list = byType.get(p.batch.entityType) ?? [];
    list.push(p);
    byType.set(p.batch.entityType, list);
  }

  for (const [entityType, items] of byType) {
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const batches: ApiPushBatch[] = chunk.map((p) => p.batch);
      const requestId = `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        if (await isDuplicateRequest(requestId)) {
          pushed += chunk.length;
          await dequeueSyncChanges(chunk.map((p) => p.dequeueKey));
          continue;
        }
        const res = await withRetry(() => syncPush(businessId, {
          requestId, opType: 'incremental', batches,
        }));
        await addSyncRequestKey(requestId);
        if (res.ok && res.data && res.data.rejected === 0) {
          pushed += res.data.accepted;
          await dequeueSyncChanges(chunk.map((p) => p.dequeueKey));
          const movementIds = chunk.map((p) => p.movementId).filter((id): id is string => !!id);
          if (movementIds.length > 0) {
            await stockMovementRepository.markSynced(movementIds);
          }
        } else {
          errors.push(`${entityType}: ${res.error?.message ?? 'rejected por el servidor'}`);
        }
      } catch (err) {
        errors.push(`${entityType}: ${err instanceof Error ? err.message : 'sync error'}`);
      }
    }
  }
  return pushed;
}

export async function syncPushData(businessId: string): Promise<SyncResult> {
  await ensureSyncState(businessId);
  const errors: string[] = [];
  const state = await syncStateRepository.get();
  const neverSynced = !state?.lastSyncAt;
  const pendingQueue = await countSyncChanges();

  let pending: PendingBatch[] = [];

  if (neverSynced && pendingQueue === 0) {
    const [products, customers, providers, orders, movements, closures, business] = await Promise.all([
      productRepository.list(),
      customerRepository.list(),
      providerRepository.list(),
      orderRepository.listAll(),
      stockMovementRepository.listPending(),
      listCashClosures(),
      getBusiness(),
    ]);
    if (business) pending.push({ batch: buildBusinessBatch(business), dequeueKey: `business:${business.id ?? business.name}` });
    for (const p of products) pending.push({ batch: buildProductBatch(p, 'upsert'), dequeueKey: `product:${p.id}` });
    for (const c of customers) pending.push({ batch: buildNamedBatch('customer', c, 'upsert'), dequeueKey: `customer:${c.id}` });
    for (const p of providers) pending.push({ batch: buildNamedBatch('provider', p, 'upsert'), dequeueKey: `provider:${p.id}` });
    for (const o of orders) pending.push({ batch: buildOrderBatch(o, 'upsert'), dequeueKey: `order:${o.id}` });
    for (const m of movements) pending.push({ batch: buildStockMovementBatch(m), dequeueKey: `stockMovement:${m.id}`, movementId: m.id });
    for (const c of closures) pending.push({ batch: buildCashClosureBatch(c), dequeueKey: `cashClosure:${c.id}` });
  } else {
    pending = await enqueueForSync(businessId);
  }

  const pushed = await pushPending(pending, businessId, errors);

  if (neverSynced && errors.length === 0) {
    await clearSyncChanges();
  }

  return { direction: 'push', pulled: 0, pushed, errors };
}

async function applyPullChanges(changes: Record<string, unknown[]>, ignore: { touch?: boolean }): Promise<{ pulled: number; errors: string[] }> {
  const errors: string[] = [];
  let pulled = 0;

  setSyncTrackingEnabled(false);
  try {
    try {
      for (const s of (changes['products'] ?? []) as ServerProductDto[]) {
        const existing = await productRepository.getById(s.id);
        const deletedAt = deletedAtOf(s);
        if (s.deleted && !deletedAt) continue;
        if (existing) {
          if (s.deleted) {
            await productRepository.update({ ...existing, active: false, updatedAt: s.updatedAt ?? undefined, deletedAt });
          } else {
            await productRepository.update({ ...existing, ...productPatchFromServer(s) });
          }
        } else {
          await productRepository.create(productFromServer(s));
        }
      }
      pulled += (changes['products'] ?? []).length;
    } catch (err) {
      errors.push(`products: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    try {
      for (const s of (changes['customers'] ?? []) as ServerNamedDto[]) {
        const existing = await customerRepository.getById(s.id);
        const deletedAt = deletedAtOf(s);
        if (s.deleted && !deletedAt) continue;
        if (existing) {
          if (s.deleted) {
            await customerRepository.update({ ...existing, updatedAt: s.updatedAt ?? undefined, deletedAt });
          } else {
            await customerRepository.update({ ...existing, ...namedPatchFromServer(s) });
          }
        } else {
          await customerRepository.create(customerFromServer(s));
        }
      }
      pulled += (changes['customers'] ?? []).length;
    } catch (err) {
      errors.push(`customers: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    try {
      for (const s of (changes['providers'] ?? []) as ServerNamedDto[]) {
        const existing = await providerRepository.getById(s.id);
        const deletedAt = deletedAtOf(s);
        if (s.deleted && !deletedAt) continue;
        if (existing) {
          if (s.deleted) {
            await providerRepository.update({ ...existing, updatedAt: s.updatedAt ?? undefined, deletedAt });
          } else {
            await providerRepository.update({ ...existing, ...namedPatchFromServer(s) });
          }
        } else {
          await providerRepository.create(providerFromServer(s));
        }
      }
      pulled += (changes['providers'] ?? []).length;
    } catch (err) {
      errors.push(`providers: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    try {
      for (const s of (changes['orders'] ?? []) as ServerOrderDto[]) {
        if (s.deleted) {
          const existing = await orderRepository.getById(s.id);
          if (existing) await orderRepository.hardRemove(s.id);
          continue;
        }
        const serverOrder = orderFromServer(s);
        const existing = await orderRepository.getById(s.id);
        if (!existing) {
          await orderRepository.save(serverOrder);
          continue;
        }
        if (existing.status === serverOrder.status) {
          if (existing.status === 'pending') {
            await orderRepository.update({
              ...existing,
              items: serverOrder.items,
              subtotalCents: serverOrder.subtotalCents,
              prepStatus: serverOrder.prepStatus ?? existing.prepStatus,
              kitchenTicketId: serverOrder.kitchenTicketId ?? existing.kitchenTicketId,
              customer: serverOrder.customer,
              updatedAt: s.updatedAt ?? undefined,
            });
          }
        } else {
          const allowed =
            (existing.status === 'pending' && (serverOrder.status === 'paid' || serverOrder.status === 'voided')) ||
            (existing.status === 'paid' && serverOrder.status === 'voided');
          if (allowed) await orderRepository.update(serverOrder);
        }
      }
      pulled += (changes['orders'] ?? []).length;
    } catch (err) {
      errors.push(`orders: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    try {
      for (const m of (changes['stockMovements'] ?? []) as ServerStockMovementDto[]) {
        await stockMovementRepository.recordMovement(toStockMovementInput(m));
      }
      pulled += (changes['stockMovements'] ?? []).length;
    } catch (err) {
      errors.push(`stockMovements: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    try {
      for (const c of (changes['cashClosures'] ?? []) as ServerCashClosureDto[]) {
        await upsertCashClosureRecord(cashClosureFromServer(c));
      }
      pulled += (changes['cashClosures'] ?? []).length;
    } catch (err) {
      errors.push(`cashClosures: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    return { pulled, errors };
  } finally {
    setSyncTrackingEnabled(true);
  }
}

export async function syncPullData(businessId: string, since?: string): Promise<SyncResult> {
  await ensureSyncState(businessId);
  const errors: string[] = [];
  let pulled = 0;
  let cursor: string | undefined;

  try {
    const res = await withRetry(() => syncPull(businessId, since));
    if (!res.ok || !res.data) {
      errors.push(res.error?.message ?? 'pull failed');
      await touchSyncState({ status: 'error' });
      return { direction: 'pull', pulled: 0, pushed: 0, errors };
    }

    const changes = res.data.changes as unknown as Record<string, unknown[]>;
    cursor = res.data.cursor;

    const applied = await applyPullChanges(changes, { touch: true });
    pulled += applied.pulled;
    errors.push(...applied.errors);

    if (changes['business'] && Array.isArray(changes['business'])) {
      pulled += changes['business'].length;
    }

    await touchSyncState({
      lastSyncAt: new Date().toISOString(),
      lastServerCursor: cursor,
      status: errors.length > 0 ? 'error' : 'idle',
    });
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'pull error');
    await touchSyncState({ status: 'error' });
  }

  return { direction: 'pull', pulled, pushed: 0, errors, cursor };
}

export async function syncSnapshot(businessId: string): Promise<SyncResult> {
  return syncPullData(businessId, undefined);
}

export async function syncFull(businessId: string): Promise<SyncResult> {
  await ensureSyncState(businessId);
  const errors: string[] = [];

  try {
    await apiRegisterDevice(businessId, 'admin');
  } catch { /* registro idempotente; ignorar fallos */ }

  const pushRes = await syncPushData(businessId);
  const pullRes = await syncPullData(businessId, await getLastCursor(businessId));

  errors.push(...pushRes.errors, ...pullRes.errors);

  return {
    direction: 'full',
    pulled: pullRes.pulled,
    pushed: pushRes.pushed,
    errors,
    cursor: pullRes.cursor,
  };
}

export async function getLastCursor(businessId: string): Promise<string | undefined> {
  const state = await syncStateRepository.get();
  return state?.lastServerCursor;
}

export type { SyncChange } from './syncChangeQueue';