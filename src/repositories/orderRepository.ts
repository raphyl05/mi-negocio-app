import type { Order } from '../models/order';
import { generateId } from '../utils/password';

export interface OrderRepository {
  save(order: Order): Promise<Order>;
  getById(id: string): Promise<Order | null>;
  listPending(): Promise<Order[]>;
  listPaid(): Promise<Order[]>;
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

    async update(order) {
      orders = orders.map((existing) => (existing.id === order.id ? order : existing));
      return order;
    },

    async remove(id) {
      orders = orders.filter((order) => order.id !== id);
    },
  };
}

export const orderRepository: OrderRepository = createInMemoryOrderRepository();