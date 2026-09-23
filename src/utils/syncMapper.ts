import type { Product, ProductImageType } from '../models/product';
import type { Customer } from '../models/customer';
import type { Provider } from '../models/provider';
import type { Order, OrderEvent, OrderPrepStatus, OrderStatus, OrderType, PaymentMethod } from '../models/order';
import type { StockMovement, StockMovementInput, StockMovementType } from '../models/stockMovement';
import type { CashClosureRecord } from '../services/cashRegisterService';
import type { Business } from '../models/business';

export type SyncAction = 'upsert' | 'delete';

const nowIso = (): string => new Date().toISOString();

export type ServerSyncRow = {
  id: string;
  deleted?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ServerProductDto = ServerSyncRow & {
  name: string;
  priceCents: number;
  openingStock?: number;
  active?: boolean;
};

export type ServerNamedDto = ServerSyncRow & {
  name: string;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
};

export type ServerOrderItemDto = {
  productId: string;
  name?: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents?: number;
};

export type ServerOrderDto = ServerSyncRow & {
  number?: number;
  status: string;
  prepStatus?: string | null;
  orderType?: string | null;
  waiterId?: string | null;
  waiterName?: string | null;
  tableId?: string | null;
  tableName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerDescription?: string | null;
  items: ServerOrderItemDto[];
  events?: unknown;
  totalCents?: number;
  receivedCents?: number;
  changeCents?: number;
  paymentMethod?: string | null;
  kitchenTicketId?: string | null;
  paidAt?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
};

export type ServerStockMovementDto = ServerSyncRow & {
  productId: string;
  movementType: string;
  quantity: number;
  deviceId?: string | null;
  createdAt?: string | null;
};

export type ServerCashClosureDto = ServerSyncRow & {
  openedAt?: string | null;
  closedAt?: string | null;
  openingAmountCents?: number;
  expectedCents?: number;
  closingAmountCents?: number;
  differenceCents?: number;
  salesByMethod?: unknown;
};

export type ServerBusinessDto = ServerSyncRow & {
  name: string;
  ownerName?: string | null;
  businessType?: string | null;
};

export function deletedAtOf(row: ServerSyncRow): string | undefined {
  if (!row.deleted) return undefined;
  return row.updatedAt ?? row.createdAt ?? nowIso();
}

export function productPatchFromServer(s: ServerProductDto, deletedAt?: string): Partial<Product> {
  return {
    name: s.name,
    priceCents: s.priceCents,
    active: s.active ?? true,
    updatedAt: s.updatedAt ?? nowIso(),
    deletedAt: deletedAt ?? deletedAtOf(s),
  };
}

export function productFromServer(s: ServerProductDto): Product {
  return {
    id: s.id,
    name: s.name,
    priceCents: s.priceCents,
    category: 'General',
    imageType: 'emoji' as ProductImageType,
    stockQuantity: s.openingStock ?? 0,
    active: s.active ?? true,
    createdAt: s.createdAt ?? nowIso(),
    updatedAt: s.updatedAt ?? undefined,
    deletedAt: deletedAtOf(s),
  };
}

export function namedPatchFromServer(s: ServerNamedDto, deletedAt?: string): Partial<Customer> {
  return {
    name: s.name,
    phone: s.phone ?? '',
    address: s.address ?? '',
    note: s.description ?? '',
    updatedAt: s.updatedAt ?? nowIso(),
    deletedAt: deletedAt ?? deletedAtOf(s),
  };
}

export function customerFromServer(s: ServerNamedDto): Customer {
  return { id: s.id, ...namedPatchFromServer(s) } as Customer;
}

export function providerFromServer(s: ServerNamedDto): Provider {
  return { id: s.id, ...namedPatchFromServer(s) } as Provider;
}

function parseOrderEvents(events: unknown): OrderEvent[] | undefined {
  if (!Array.isArray(events)) return undefined;
  return events as OrderEvent[];
}

export function orderFromServer(s: ServerOrderDto): Order {
  const status = ['pending', 'paid', 'voided'].includes(s.status) ? (s.status as OrderStatus) : 'pending';
  const paymentMethod = s.paymentMethod === 'transfer' ? ('transfer' as const) : s.paymentMethod === 'cash' ? ('cash' as const) : undefined;
  const orderType = s.orderType === 'waiter' ? ('waiter' as const) : s.orderType === 'counter' ? ('counter' as const) : undefined;
  const prepStatus = (['sent', 'preparing', 'ready', 'served'] as string[]).includes(s.prepStatus ?? '') ? (s.prepStatus as OrderPrepStatus) : undefined;

  return {
    id: s.id,
    number: s.number ?? 0,
    items: (s.items ?? []).map((i) => ({
      product: {
        id: i.productId,
        name: i.name ?? 'Artículo',
        priceCents: i.unitPriceCents,
        category: 'General',
        imageType: 'emoji' as ProductImageType,
        stockQuantity: 0,
        active: true,
        createdAt: s.createdAt ?? nowIso(),
      },
      quantity: i.quantity,
    })),
    subtotalCents: s.totalCents ?? 0,
    customer: {
      customerId: s.customerId ?? undefined,
      customerName: s.customerName ?? '',
      phone: s.customerPhone ?? '',
      address: s.customerAddress ?? '',
      description: s.customerDescription ?? '',
    },
    status,
    paymentMethod,
    receivedCents: s.receivedCents,
    changeCents: s.changeCents,
    orderType,
    waiterId: s.waiterId ?? undefined,
    waiterName: s.waiterName ?? undefined,
    tableId: s.tableId ?? undefined,
    tableName: s.tableName ?? undefined,
    prepStatus,
    events: parseOrderEvents(s.events),
    kitchenTicketId: s.kitchenTicketId ?? undefined,
    createdAt: s.createdAt ?? nowIso(),
    updatedAt: s.updatedAt ?? undefined,
    paidAt: s.paidAt ?? undefined,
    voidedAt: s.voidedAt ?? undefined,
    voidReason: s.voidReason ?? undefined,
  };
}

const MOVEMENT_TYPE_MAP: Record<string, StockMovementType> = {
  opening: 'INITIAL_STOCK',
  sale: 'SALE',
  return: 'RETURN',
  adjustment: 'ADJUSTMENT',
  purchase: 'ADJUSTMENT',
  SALE: 'SALE',
  RETURN: 'RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
  INITIAL_STOCK: 'INITIAL_STOCK',
};

export function toStockMovementInput(s: ServerStockMovementDto): StockMovementInput {
  return {
    id: s.id,
    productId: s.productId,
    quantity: s.quantity,
    movementType: MOVEMENT_TYPE_MAP[s.movementType] ?? 'ADJUSTMENT',
    deviceId: s.deviceId ?? undefined,
    createdAt: s.createdAt ?? nowIso(),
    synced: true,
  };
}

function parseCents(v: number | undefined | null, fallback = 0): number {
  return typeof v === 'number' && isFinite(v) ? v : fallback;
}

export function cashClosureFromServer(s: ServerCashClosureDto): CashClosureRecord {
  const byMethod = (s.salesByMethod ?? {}) as Record<string, unknown>;
  const sales = (by: string): number =>
    typeof byMethod[by] === 'number' ? (byMethod[by] as number) : 0;
  const cashSalesCents = sales('cash');
  const transferSalesCents = sales('transfer');

  return {
    id: s.id,
    closedAt: s.closedAt ?? s.updatedAt ?? nowIso(),
    openingAmountCents: parseCents(s.openingAmountCents),
    expectedCashCents: parseCents(s.expectedCents),
    countedCashCents: parseCents(s.closingAmountCents),
    differenceCents: parseCents(s.differenceCents),
    orderCount: 0,
    salesCents: cashSalesCents + transferSalesCents,
    cashSalesCents,
    transferSalesCents,
  };
}

export type PushBatch = {
  entityType: string;
  action: SyncAction;
  id: string;
  entity: Record<string, unknown>;
};

export function buildProductBatch(p: Product, action: SyncAction): PushBatch {
  return action === 'delete'
    ? { entityType: 'product', action, id: p.id, entity: { id: p.id } }
    : {
        entityType: 'product',
        action,
        id: p.id,
        entity: {
          id: p.id,
          name: p.name,
          priceCents: p.priceCents,
          openingStock: p.stockQuantity,
          active: p.active,
          updatedAt: p.updatedAt,
        },
      };
}

export function buildNamedBatch(entityType: 'customer' | 'provider', e: Customer | Provider, action: SyncAction): PushBatch {
  return action === 'delete'
    ? { entityType, action, id: e.id, entity: { id: e.id } }
    : {
        entityType,
        action,
        id: e.id,
        entity: {
          id: e.id,
          name: e.name,
          phone: e.phone,
          address: e.address,
          description: e.note,
        },
      };
}

export function buildOrderBatch(o: Order, action: SyncAction): PushBatch {
  return action === 'delete'
    ? { entityType: 'order', action, id: o.id, entity: { id: o.id } }
    : {
        entityType: 'order',
        action,
        id: o.id,
        entity: {
          id: o.id,
          number: o.number,
          status: o.status,
          prepStatus: o.prepStatus,
          orderType: o.orderType ?? 'counter',
          waiterId: o.waiterId,
          waiterName: o.waiterName,
          tableId: o.tableId,
          tableName: o.tableName,
          customerId: o.customer.customerId ?? o.customer.customerName,
          customerName: o.customer.customerName,
          customerPhone: o.customer.phone,
          customerAddress: o.customer.address,
          customerDescription: o.customer.description,
          paymentMethod: o.paymentMethod,
          receivedCents: o.receivedCents,
          changeCents: o.changeCents,
          items: o.items.map((i) => ({
            productId: i.product.id,
            name: i.product.name,
            quantity: i.quantity,
            unitPriceCents: i.product.priceCents,
            lineTotalCents: i.product.priceCents * i.quantity,
          })),
          totalCents: o.subtotalCents,
          events: o.events,
          paidAt: o.paidAt,
          voidedAt: o.voidedAt,
          voidReason: o.voidReason,
        },
      };
}

export function buildStockMovementBatch(m: StockMovement): PushBatch {
  return {
    entityType: 'stockMovement',
    action: 'upsert',
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

export function buildCashClosureBatch(c: CashClosureRecord): PushBatch {
  return {
    entityType: 'cashClosure',
    action: 'upsert',
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

export function buildBusinessBatch(b: Business): PushBatch {
  return {
    entityType: 'business',
    action: 'upsert',
    id: b.id ?? b.name,
    entity: { id: b.id, name: b.name, ownerName: b.ownerName },
  };
}