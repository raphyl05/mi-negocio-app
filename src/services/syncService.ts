import { getBusiness } from './setupService';
import { productRepository } from '../repositories/productRepository';
import { customerRepository } from '../repositories/customerRepository';
import { providerRepository } from '../repositories/providerRepository';
import { orderRepository } from '../repositories/orderRepository';
import { stockMovementRepository } from '../repositories/stockMovementRepository';
import { listCashClosures } from './cashRegisterService';
import { syncPull, syncPush } from './syncApi';
import { syncStateRepository } from '../repositories/syncStateRepository';
import { ensureSyncState, touchSyncState } from './syncStateService';
import { getDeviceId } from '../utils/syncIdentity';
import type { Product } from '../models/product';
import type { Customer } from '../models/customer';
import type { Provider } from '../models/provider';
import type { Order } from '../models/order';
import type { StockMovement } from '../models/stockMovement';
import type { CashClosureRecord } from './cashRegisterService';
import type { Business } from '../models/business';

export type SyncDirection = 'pull' | 'push' | 'full';

export type SyncResult = {
  direction: SyncDirection;
  pulled: number;
  pushed: number;
  errors: string[];
  cursor?: string;
};

function toProductBatch(p: Product) {
  return {
    entityType: 'product' as const,
    id: p.id,
    entity: {
      id: p.id,
      name: p.name,
      priceCents: p.priceCents,
      openingStock: p.stockQuantity,
      active: p.active,
    },
  };
}

function toCustomerBatch(c: Customer) {
  return {
    entityType: 'customer' as const,
    id: c.id,
    entity: {
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.address,
      description: c.note,
    },
  };
}

function toProviderBatch(p: Provider) {
  return {
    entityType: 'provider' as const,
    id: p.id,
    entity: {
      id: p.id,
      name: p.name,
      phone: p.phone,
      address: p.address,
      description: p.note,
    },
  };
}

function toOrderBatch(o: Order) {
  return {
    entityType: 'order' as const,
    id: o.id,
    entity: {
      id: o.id,
      status: o.status,
      orderType: o.status === 'paid' ? 'in_store' : 'in_store',
      items: o.items.map((i) => ({
        productId: i.product.id,
        name: i.product.name,
        quantity: i.quantity,
        unitPriceCents: i.product.priceCents,
        lineTotalCents: i.product.priceCents * i.quantity,
      })),
      totalCents: o.subtotalCents,
      paymentMethod: o.paymentMethod,
      customerId: o.customer.customerName,
      customerName: o.customer.customerName,
      customerPhone: o.customer.phone,
      customerAddress: o.customer.address,
    },
  };
}

function toStockMovementBatch(m: StockMovement) {
  return {
    entityType: 'stockMovement' as const,
    id: m.id,
    entity: {
      id: m.id,
      productId: m.productId,
      movementType: m.movementType,
      quantity: m.quantity,
      deviceId: m.deviceId,
    },
  };
}

function toCashClosureBatch(c: CashClosureRecord) {
  return {
    entityType: 'cashClosure' as const,
    id: c.id,
    entity: {
      id: c.id,
      openingAmountCents: c.openingAmountCents,
      expectedCents: c.expectedCashCents,
      closingAmountCents: c.countedCashCents,
      differenceCents: c.differenceCents,
    },
  };
}

export async function syncPushData(businessId: string): Promise<SyncResult> {
  const errors: string[] = [];
  let pushed = 0;

  try {
    const business = await getBusiness();
    if (business) {
      const batch = {
        entityType: 'business' as const,
        id: business.id ?? business.name,
        entity: { id: business.id, name: business.name, ownerName: business.ownerName },
      };
      const res = await syncPush(businessId, {
        requestId: `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        opType: 'incremental',
        batches: [batch],
      });
      if (res.ok) pushed++;
      else errors.push(`business: ${res.error?.message ?? 'unknown'}`);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'business sync error');
  }

  try {
    const products = await productRepository.list();
    if (products.length > 0) {
      const batches = products.map(toProductBatch);
      const res = await syncPush(businessId, {
        requestId: `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        opType: 'incremental',
        batches,
      });
      if (res.ok) pushed += res.data?.accepted ?? 0;
      else errors.push(`products: ${res.error?.message ?? 'unknown'}`);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'products sync error');
  }

  try {
    const customers = await customerRepository.list();
    if (customers.length > 0) {
      const batches = customers.map(toCustomerBatch);
      const res = await syncPush(businessId, {
        requestId: `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        opType: 'incremental',
        batches,
      });
      if (res.ok) pushed += res.data?.accepted ?? 0;
      else errors.push(`customers: ${res.error?.message ?? 'unknown'}`);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'customers sync error');
  }

  try {
    const providers = await providerRepository.list();
    if (providers.length > 0) {
      const batches = providers.map(toProviderBatch);
      const res = await syncPush(businessId, {
        requestId: `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        opType: 'incremental',
        batches,
      });
      if (res.ok) pushed += res.data?.accepted ?? 0;
      else errors.push(`providers: ${res.error?.message ?? 'unknown'}`);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'providers sync error');
  }

  try {
    const orders = await orderRepository.listAll();
    if (orders.length > 0) {
      const batches = orders.map(toOrderBatch);
      const res = await syncPush(businessId, {
        requestId: `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        opType: 'incremental',
        batches,
      });
      if (res.ok) pushed += res.data?.accepted ?? 0;
      else errors.push(`orders: ${res.error?.message ?? 'unknown'}`);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'orders sync error');
  }

  try {
    const movements = await stockMovementRepository.listAll();
    if (movements.length > 0) {
      const batches = movements.map(toStockMovementBatch);
      const res = await syncPush(businessId, {
        requestId: `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        opType: 'incremental',
        batches,
      });
      if (res.ok) pushed += res.data?.accepted ?? 0;
      else errors.push(`stockMovements: ${res.error?.message ?? 'unknown'}`);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'stockMovements sync error');
  }

  try {
    const closures = await listCashClosures();
    if (closures.length > 0) {
      const batches = closures.map(toCashClosureBatch);
      const res = await syncPush(businessId, {
        requestId: `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        opType: 'incremental',
        batches,
      });
      if (res.ok) pushed += res.data?.accepted ?? 0;
      else errors.push(`cashClosures: ${res.error?.message ?? 'unknown'}`);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'cashClosures sync error');
  }

  return { direction: 'push', pulled: 0, pushed, errors };
}

export async function syncPullData(businessId: string, since?: string): Promise<SyncResult> {
  const errors: string[] = [];
  let pulled = 0;
  let cursor: string | undefined;

  try {
    const res = await syncPull(businessId, since);
    if (!res.ok || !res.data) {
      errors.push(res.error?.message ?? 'pull failed');
      return { direction: 'pull', pulled: 0, pushed: 0, errors };
    }

    const changes = res.data.changes;
    cursor = res.data.cursor;

    if (changes.business) {
      try {
        // Business data pulled — store via getBusiness/saveBusiness if needed
        pulled++;
      } catch { /* business handled separately */ }
    }

    if (changes.products?.length) {
      try {
        for (const p of changes.products as unknown as Product[]) {
          const existing = await productRepository.getById(p.id);
          if (existing) {
            await productRepository.update({ ...existing, ...p });
          }
        }
        pulled += changes.products.length;
      } catch (err) {
        errors.push(`products: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    if (changes.customers?.length) {
      try {
        for (const c of changes.customers as unknown as Customer[]) {
          const existing = await customerRepository.getById(c.id);
          if (existing) {
            await customerRepository.update({ ...existing, ...c });
          }
        }
        pulled += changes.customers.length;
      } catch (err) {
        errors.push(`customers: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    if (changes.providers?.length) {
      try {
        for (const p of changes.providers as unknown as Provider[]) {
          const existing = await providerRepository.getById(p.id);
          if (existing) {
            await providerRepository.update({ ...existing, ...p });
          }
        }
        pulled += changes.providers.length;
      } catch (err) {
        errors.push(`providers: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    if (changes.orders?.length) {
      try {
        for (const o of changes.orders as unknown as Order[]) {
          const existing = await orderRepository.getById(o.id);
          if (existing) {
            await orderRepository.update({ ...existing, ...o });
          }
        }
        pulled += changes.orders.length;
      } catch (err) {
        errors.push(`orders: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    if (changes.stockMovements?.length) {
      try {
        for (const m of changes.stockMovements as unknown as StockMovement[]) {
          await stockMovementRepository.recordMovement({
            id: m.id,
            productId: m.productId,
            movementType: m.movementType,
            quantity: m.quantity,
            deviceId: m.deviceId,
          });
        }
        pulled += changes.stockMovements.length;
      } catch (err) {
        errors.push(`stockMovements: ${err instanceof Error ? err.message : 'unknown'}`);
      }
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

export async function syncFull(businessId: string): Promise<SyncResult> {
  const pullRes = await syncPullData(businessId);
  const pushRes = await syncPushData(businessId);
  return {
    direction: 'full',
    pulled: pullRes.pulled,
    pushed: pushRes.pushed,
    errors: [...pullRes.errors, ...pushRes.errors],
    cursor: pullRes.cursor,
  };
}

export async function getLastCursor(businessId: string): Promise<string | undefined> {
  const state = await syncStateRepository.get();
  return state?.lastServerCursor;
}
