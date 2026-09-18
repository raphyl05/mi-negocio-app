import type { SQLiteDatabase } from 'expo-sqlite';
import type { Order } from '../models/order';
import type { CartItem } from '../utils/cart';
import { generateId } from '../utils/password';
import { getDatabase, getNextOrderNumber, setNextOrderNumber } from './database.native';
import type { OrderRepository } from './orderRepository';

type OrderRow = {
  id: string;
  number: number;
  items: string;
  subtotalCents: number;
  customerName: string;
  phone: string;
  address: string;
  description: string;
  status: Order['status'];
  paymentMethod: Order['paymentMethod'];
  receivedCents: number | null;
  changeCents: number | null;
  createdAt: string;
  paidAt: string | null;
};

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    number: row.number,
    items: JSON.parse(row.items) as CartItem[],
    subtotalCents: row.subtotalCents,
    customer: {
      customerName: row.customerName,
      phone: row.phone,
      address: row.address,
      description: row.description,
    },
    status: row.status,
    paymentMethod: row.paymentMethod ?? undefined,
    receivedCents: row.receivedCents ?? undefined,
    changeCents: row.changeCents ?? undefined,
    createdAt: row.createdAt,
    paidAt: row.paidAt ?? undefined,
  };
}

async function insertOrder(db: SQLiteDatabase, order: Order): Promise<void> {
  await db.runAsync(
    `INSERT INTO orders (id, number, items, subtotalCents, customerName, phone, address, description, status, paymentMethod, receivedCents, changeCents, createdAt, paidAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      order.id,
      order.number,
      JSON.stringify(order.items),
      order.subtotalCents,
      order.customer.customerName,
      order.customer.phone,
      order.customer.address,
      order.customer.description,
      order.status,
      order.paymentMethod ?? null,
      order.receivedCents ?? null,
      order.changeCents ?? null,
      order.createdAt,
      order.paidAt ?? null,
    ],
  );
}

export async function createSqliteOrderRepository(): Promise<OrderRepository> {
  const db = await getDatabase();

  return {
    async save(order) {
      const id = order.id || generateId();
      const number = order.number > 0 ? order.number : await getNextOrderNumber(db);
      const currentNext = await getNextOrderNumber(db);
      if (number >= currentNext) {
        await setNextOrderNumber(db, number + 1);
      }
      const saved = { ...order, id, number };
      await insertOrder(db, saved);
      return saved;
    },

    async getById(id) {
      const row = await db.getFirstAsync<OrderRow>('SELECT * FROM orders WHERE id = ?', id);
      return row ? rowToOrder(row) : null;
    },

    async listPending() {
      const rows = await db.getAllAsync<OrderRow>(
        "SELECT * FROM orders WHERE status = 'pending' ORDER BY createdAt DESC",
      );
      return rows.map(rowToOrder);
    },

    async listPaid() {
      const rows = await db.getAllAsync<OrderRow>(
        "SELECT * FROM orders WHERE status = 'paid' ORDER BY createdAt DESC",
      );
      return rows.map(rowToOrder);
    },

    async update(order) {
      await db.runAsync(
        `UPDATE orders SET items = ?, subtotalCents = ?, customerName = ?, phone = ?, address = ?, description = ?, status = ?, paymentMethod = ?, receivedCents = ?, changeCents = ?, paidAt = ?
         WHERE id = ?`,
        [
          JSON.stringify(order.items),
          order.subtotalCents,
          order.customer.customerName,
          order.customer.phone,
          order.customer.address,
          order.customer.description,
          order.status,
          order.paymentMethod ?? null,
          order.receivedCents ?? null,
          order.changeCents ?? null,
          order.paidAt ?? null,
          order.id,
        ],
      );
      return order;
    },

    async remove(id) {
      await db.runAsync('DELETE FROM orders WHERE id = ?', id);
    },
  };
}