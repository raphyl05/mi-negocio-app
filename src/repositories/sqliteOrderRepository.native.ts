import type { SQLiteDatabase } from 'expo-sqlite';
import type { Order } from '../models/order';
import type { CartItem } from '../utils/cart';
import { assertOrderTransition } from '../utils/orderState';
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
  updatedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  deletedAt: string | null;
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
    orderType: 'counter',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? undefined,
    paidAt: row.paidAt ?? undefined,
    voidedAt: row.voidedAt ?? undefined,
    voidReason: row.voidReason ?? undefined,
  };
}

async function insertOrder(db: SQLiteDatabase, order: Order): Promise<void> {
  await db.runAsync(
    `INSERT INTO orders (id, number, items, subtotalCents, customerName, phone, address, description, status, paymentMethod, receivedCents, changeCents, createdAt, updatedAt, paidAt, voidedAt, voidReason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      order.updatedAt ?? order.createdAt,
      order.paidAt ?? null,
      order.voidedAt ?? null,
      order.voidReason ?? null,
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
      const saved = { ...order, id, number, updatedAt: order.updatedAt ?? order.createdAt };
      await insertOrder(db, saved);
      return saved;
    },

    async getById(id) {
      const row = await db.getFirstAsync<OrderRow>(
        'SELECT * FROM orders WHERE id = ? AND deletedAt IS NULL',
        id,
      );
      return row ? rowToOrder(row) : null;
    },

    async listPending() {
      const rows = await db.getAllAsync<OrderRow>(
        "SELECT * FROM orders WHERE status = 'pending' AND deletedAt IS NULL ORDER BY createdAt DESC",
      );
      return rows.map(rowToOrder);
    },

    async listPaid() {
      const rows = await db.getAllAsync<OrderRow>(
        "SELECT * FROM orders WHERE status = 'paid' AND deletedAt IS NULL ORDER BY createdAt DESC",
      );
      return rows.map(rowToOrder);
    },

    async listAll() {
      const rows = await db.getAllAsync<OrderRow>(
        'SELECT * FROM orders WHERE deletedAt IS NULL ORDER BY createdAt DESC',
      );
      return rows.map(rowToOrder);
    },

    async listAllIncludingDeleted() {
      const rows = await db.getAllAsync<OrderRow>(
        'SELECT * FROM orders ORDER BY createdAt DESC',
      );
      return rows.map(rowToOrder);
    },

    async update(order) {
      const row = await db.getFirstAsync<{ status: OrderRow['status'] }>(
        'SELECT status FROM orders WHERE id = ? AND deletedAt IS NULL',
        order.id,
      );
      if (!row) throw new Error('La orden ya no existe.');
      assertOrderTransition(row.status, order.status);
      const updatedAt = new Date().toISOString();
      await db.runAsync(
        `UPDATE orders SET items = ?, subtotalCents = ?, customerName = ?, phone = ?, address = ?, description = ?, status = ?, paymentMethod = ?, receivedCents = ?, changeCents = ?, paidAt = ?, voidedAt = ?, voidReason = ?, updatedAt = ?
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
          order.voidedAt ?? null,
          order.voidReason ?? null,
          updatedAt,
          order.id,
        ],
      );
      return { ...order, updatedAt };
    },

    async remove(id) {
      const stamped = new Date().toISOString();
      await db.runAsync(
        'UPDATE orders SET deletedAt = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL',
        stamped,
        stamped,
        id,
      );
    },

    async hardRemove(id) {
      await db.runAsync('DELETE FROM orders WHERE id = ?', id);
    },
  };
}