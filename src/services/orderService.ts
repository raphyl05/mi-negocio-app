import type { Order, PaymentMethod } from '../models/order';
import type { CartItem } from '../utils/cart';
import { findStockIssue } from '../utils/cart';
import { buildOrder } from '../utils/order';
import { calcChange } from '../utils/money';
import type { OrderRepository } from '../repositories/orderRepository';
import type { ProductRepository } from '../repositories/productRepository';
import { orderRepository } from '../repositories/orderRepository';
import { productRepository } from '../repositories/productRepository';
import { stockMovementRepository } from '../repositories/stockMovementRepository';
import type { StockMovementRepository } from '../repositories/stockMovementRepository';
import { withTransaction } from '../repositories/transaction';
import { reserveOrderStock, releaseOrderStock } from './stockService';

export type OrderActionResult =
  | { ok: true; order: Order }
  | { ok: false; message: string };

export type SavePendingInput = {
  items: CartItem[];
  customer: Order['customer'];
  orderType?: Order['orderType'];
  waiterId?: string;
  waiterName?: string;
  tableId?: string;
  tableName?: string;
  prepStatus?: Order['prepStatus'];
};

export type PayNewInput = SavePendingInput & {
  paymentMethod: PaymentMethod;
  receivedCents?: number;
};

export type OrderService = {
  savePendingOrder(input: SavePendingInput): Promise<OrderActionResult>;
  payNewOrder(input: PayNewInput): Promise<OrderActionResult>;
  payPendingOrder(orderId: string, paymentMethod: PaymentMethod, receivedCents?: number): Promise<OrderActionResult>;
  cancelPendingOrder(orderId: string): Promise<OrderActionResult>;
  voidOrder(orderId: string, reason?: string): Promise<OrderActionResult>;
};

type OrderServiceDeps = {
  orderRepo: OrderRepository;
  productRepo: ProductRepository;
  movementRepo?: StockMovementRepository;
  withTransaction?: <T>(fn: () => Promise<T>) => Promise<T>;
};

export function createOrderService({ orderRepo, productRepo, movementRepo, withTransaction: txn = withTransaction }: OrderServiceDeps): OrderService {
  const stockProblem = async (items: CartItem[]): Promise<string | null> => {
    const live = await productRepo.list();
    const issue = findStockIssue(items, live);
    if (!issue) return null;
    if (issue.available === 0 && !live.some((p) => p.id === issue.product.id)) {
      return `"${issue.product.name}" ya no está en el catálogo. Actualiza o elimina la orden.`;
    }
    return `Stock insuficiente para "${issue.product.name}": quedan ${issue.available} y llevas ${
      items.find((item) => item.product.id === issue.product.id)?.quantity ?? 0
    }.`;
  };

  const markVoided = (existing: Order, reason?: string): Order => ({
    ...existing,
    status: 'voided',
    voidedAt: new Date().toISOString(),
    voidReason: (reason ?? '').trim() || 'Anulación',
  });

  const fail = (err: unknown): { ok: false; message: string } => ({
    ok: false,
    message: err instanceof Error ? err.message : 'No se pudo completar la operación.',
  });

  return {
    async savePendingOrder(input) {
      try {
        const saved = await txn(async () => {
          const problem = await stockProblem(input.items);
          if (problem) throw new Error(problem);
          const order = buildOrder({
            items: input.items,
            customer: input.customer,
            status: 'pending',
            orderType: input.orderType,
            waiterId: input.waiterId,
            waiterName: input.waiterName,
            tableId: input.tableId,
            tableName: input.tableName,
            prepStatus: input.prepStatus,
          });
          const created = await orderRepo.save(order);
          await reserveOrderStock(created.items, productRepo, { movementRepo, referenceId: created.id });
          return created;
        });
        return { ok: true, order: saved };
      } catch (err) {
        return fail(err);
      }
    },

    async payNewOrder(input) {
      try {
        const saved = await txn(async () => {
          const problem = await stockProblem(input.items);
          if (problem) throw new Error(problem);
          const order = buildOrder({
            items: input.items,
            customer: input.customer,
            status: 'paid',
            paymentMethod: input.paymentMethod,
            receivedCents: input.receivedCents,
            orderType: input.orderType,
            waiterId: input.waiterId,
            waiterName: input.waiterName,
            tableId: input.tableId,
            tableName: input.tableName,
            prepStatus: input.prepStatus,
          });
          const created = await orderRepo.save(order);
          await reserveOrderStock(created.items, productRepo, { movementRepo, referenceId: created.id });
          return created;
        });
        return { ok: true, order: saved };
      } catch (err) {
        return fail(err);
      }
    },

    async payPendingOrder(orderId, paymentMethod, receivedCents) {
      try {
        const paid = await txn(async () => {
          const existing = await orderRepo.getById(orderId);
          if (!existing) throw new Error('La orden ya no existe.');
          if (existing.status === 'paid') throw new Error('Esta orden ya fue cobrada.');
          if (existing.status === 'voided') throw new Error('Esta orden fue anulada y no se puede cobrar.');

          const changeCents =
            paymentMethod === 'cash' && receivedCents !== undefined
              ? calcChange(existing.subtotalCents, receivedCents)
              : undefined;

          return orderRepo.update({
            ...existing,
            status: 'paid',
            paymentMethod,
            receivedCents,
            changeCents,
            paidAt: new Date().toISOString(),
          });
        });
        return { ok: true, order: paid };
      } catch (err) {
        return fail(err);
      }
    },

    async cancelPendingOrder(orderId) {
      try {
        const existing = await txn(async () => {
          const found = await orderRepo.getById(orderId);
          if (!found) throw new Error('La orden ya no existe.');
          if (found.status !== 'pending') {
            throw new Error('Solo se pueden eliminar órdenes pendientes.');
          }

          await orderRepo.remove(found.id);
          await releaseOrderStock(found.items, productRepo, { movementRepo, referenceId: found.id });
          return found;
        });
        return { ok: true, order: existing };
      } catch (err) {
        return fail(err);
      }
    },

    async voidOrder(orderId, reason) {
      try {
        const voided = await txn(async () => {
          const existing = await orderRepo.getById(orderId);
          if (!existing) throw new Error('La orden ya no existe.');
          if (existing.status === 'voided') throw new Error('Esta venta ya fue anulada anteriormente.');

          const marked = markVoided(existing, reason);
          await orderRepo.update(marked);
          await releaseOrderStock(existing.items, productRepo, { movementRepo, referenceId: existing.id });
          return marked;
        });
        return { ok: true, order: voided };
      } catch (err) {
        return fail(err);
      }
    },
  };
}

export const orderService: OrderService = createOrderService({
  orderRepo: orderRepository,
  productRepo: productRepository,
  movementRepo: stockMovementRepository,
});