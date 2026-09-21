import type { Customer } from '../models/customer';
import { generateId } from '../utils/password';
import { getDatabase } from './database.native';
import type { CustomerInput, CustomerRepository } from './customerRepository';

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
  note: string;
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? undefined,
    deletedAt: row.deletedAt ?? undefined,
  };
}

export async function createSqliteCustomerRepository(): Promise<CustomerRepository> {
  const db = await getDatabase();

  return {
    async list() {
      const rows = await db.getAllAsync<CustomerRow>(
        'SELECT * FROM customers WHERE deletedAt IS NULL ORDER BY name COLLATE NOCASE ASC',
      );
      return rows.map(rowToCustomer);
    },

    async listIncludingDeleted() {
      const rows = await db.getAllAsync<CustomerRow>(
        'SELECT * FROM customers ORDER BY name COLLATE NOCASE ASC',
      );
      return rows.map(rowToCustomer);
    },

    async getById(id) {
      const row = await db.getFirstAsync<CustomerRow>(
        'SELECT * FROM customers WHERE id = ? AND deletedAt IS NULL',
        id,
      );
      return row ? rowToCustomer(row) : null;
    },

    async create(customer: CustomerInput) {
      const created: Customer = {
        ...customer,
        id: customer.id || generateId(),
        updatedAt: customer.updatedAt ?? customer.createdAt,
      };
      await db.runAsync(
        `INSERT INTO customers (id, name, phone, address, note, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          created.id,
          created.name,
          created.phone,
          created.address,
          created.note,
          created.createdAt,
          created.updatedAt ?? created.createdAt,
        ],
      );
      return created;
    },

    async update(customer) {
      const updatedAt = new Date().toISOString();
      await db.runAsync(
        `UPDATE customers SET name = ?, phone = ?, address = ?, note = ?, updatedAt = ?
         WHERE id = ? AND deletedAt IS NULL`,
        [customer.name, customer.phone, customer.address, customer.note, updatedAt, customer.id],
      );
      return { ...customer, updatedAt };
    },

    async remove(id) {
      const stamped = new Date().toISOString();
      await db.runAsync(
        'UPDATE customers SET deletedAt = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL',
        stamped,
        stamped,
        id,
      );
    },

    async hardRemove(id) {
      await db.runAsync('DELETE FROM customers WHERE id = ?', id);
    },
  };
}