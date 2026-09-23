import { Platform } from 'react-native';
import type { Order } from '../models/order';
import { assertOrderTransition } from '../utils/orderState';
import { generateId } from '../utils/password';
import { enqueueSyncChange } from '../services/syncChangeQueue';
import { createSqliteOrderRepository } from './sqliteOrderRepository';

export interface OrderRepository {
  save(order: Order): Promise<Order>;
  getById(id: string): Promise<Order | null>;
  listPending(): Promise<Order[]>;
  listPaid(): Promise<Order[]>;
  listAll(): Promise<Order[]>;
  listAllIncludingDeleted(): Promise<Order[]>;
  update(order: Order): Promise<Order>;
  remove(id: string): Promise<void>;
  hardRemove(id: string): Promise<void>;
}

export function createInMemoryOrderRepository(): OrderRepository {
  type Stored = Order & { deletedAt?: string };
  let orders: Stored[] = [];
  let nextNumber = 1;

  return {
    async save(order) {
      const saved: Stored = {
        ...order,
        id: order.id || generateId(),
        number: order.number > 0 ? order.number : nextNumber,
        updatedAt: order.updatedAt ?? order.createdAt,
      };
      if (saved.number >= nextNumber) {
        nextNumber = saved.number + 1;
      }
      orders = [...orders, saved];
      return saved;
    },

    async getById(id) {
      const order = orders.find((o) => o.id === id && !o.deletedAt);
      return order ? { ...order } : null;
    },

    async listPending() {
      return orders
        .filter((order) => order.status === 'pending' && !order.deletedAt)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async listPaid() {
      return orders
        .filter((order) => order.status === 'paid' && !order.deletedAt)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async listAll() {
      return orders
        .filter((order) => !order.deletedAt)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async listAllIncludingDeleted() {
      return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async update(order) {
      const existing = orders.find((found) => found.id === order.id && !found.deletedAt);
      if (!existing) throw new Error('La orden ya no existe.');
      assertOrderTransition(existing.status, order.status);
      const updated: Stored = { ...order, updatedAt: new Date().toISOString() };
      orders = orders.map((found) => (found.id === order.id ? updated : found));
      return updated;
    },

    async remove(id) {
      const stamped = new Date().toISOString();
      orders = orders.map((order) =>
        order.id === id && !order.deletedAt
          ? { ...order, deletedAt: stamped, updatedAt: stamped }
          : order,
      );
    },

    async hardRemove(id) {
      orders = orders.filter((order) => order.id !== id);
    },
  };
}

class LazyOrderRepository implements OrderRepository {
  private implPromise: Promise<OrderRepository> | null = null;

  reset(): void {
    this.implPromise = null;
  }

  private ready(): Promise<OrderRepository> {
    if (!this.implPromise) {
      this.implPromise =
        Platform.OS === 'web'
          ? Promise.resolve(createInMemoryOrderRepository())
          : createSqliteOrderRepository();
    }
    return this.implPromise;
  }

  async save(order: Order) {
    const saved = await (await this.ready()).save(order);
    await enqueueSyncChange('order', saved.id, 'upsert');
    return saved;
  }

  async getById(id: string) {
    return (await this.ready()).getById(id);
  }

  async listPending() {
    return (await this.ready()).listPending();
  }

  async listPaid() {
    return (await this.ready()).listPaid();
  }

  async listAll() {
    return (await this.ready()).listAll();
  }

  async listAllIncludingDeleted() {
    return (await this.ready()).listAllIncludingDeleted();
  }

  async update(order: Order) {
    const updated = await (await this.ready()).update(order);
    await enqueueSyncChange('order', updated.id, 'upsert');
    return updated;
  }

  async remove(id: string) {
    await (await this.ready()).remove(id);
    await enqueueSyncChange('order', id, 'delete');
  }

  async hardRemove(id: string) {
    await (await this.ready()).hardRemove(id);
    await enqueueSyncChange('order', id, 'delete');
  }
}

export const orderRepository: OrderRepository = new LazyOrderRepository();

export function resetOrderRepository(): void {
  (orderRepository as LazyOrderRepository).reset();
}