import { Platform } from 'react-native';
import type { Order } from '../models/order';
import { generateId } from '../utils/password';
import { createSqliteOrderRepository } from './sqliteOrderRepository';

export interface OrderRepository {
  save(order: Order): Promise<Order>;
  getById(id: string): Promise<Order | null>;
  listPending(): Promise<Order[]>;
  listPaid(): Promise<Order[]>;
  listAll(): Promise<Order[]>;
  update(order: Order): Promise<Order>;
  remove(id: string): Promise<void>;
}

export function createInMemoryOrderRepository(): OrderRepository {
  let orders: Order[] = [];
  let nextNumber = 1;

  return {
    async save(order) {
      const saved: Order = {
        ...order,
        id: order.id || generateId(),
        number: order.number > 0 ? order.number : nextNumber,
      };
      if (saved.number >= nextNumber) {
        nextNumber = saved.number + 1;
      }
      orders = [...orders, saved];
      return saved;
    },

    async getById(id) {
      return orders.find((order) => order.id === id) ?? null;
    },

    async listPending() {
      return orders
        .filter((order) => order.status === 'pending')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async listPaid() {
      return orders
        .filter((order) => order.status === 'paid')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async listAll() {
      return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async update(order) {
      orders = orders.map((existing) => (existing.id === order.id ? order : existing));
      return order;
    },

    async remove(id) {
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
    return (await this.ready()).save(order);
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

  async update(order: Order) {
    return (await this.ready()).update(order);
  }

  async remove(id: string) {
    return (await this.ready()).remove(id);
  }
}

export const orderRepository: OrderRepository = new LazyOrderRepository();

export function resetOrderRepository(): void {
  (orderRepository as LazyOrderRepository).reset();
}