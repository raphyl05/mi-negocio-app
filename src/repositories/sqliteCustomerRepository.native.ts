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
};

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    note: row.note,
    createdAt: row.createdAt,
  };
}

export async function createSqliteCustomerRepository(): Promise<CustomerRepository> {
  const db = await getDatabase();

  return {
    async list() {
      const rows = await db.getAllAsync<CustomerRow>('SELECT * FROM customers ORDER BY name COLLATE NOCASE ASC');
      return rows.map(rowToCustomer);
    },

    async getById(id) {
      const row = await db.getFirstAsync<CustomerRow>('SELECT * FROM customers WHERE id = ?', id);
      return row ? rowToCustomer(row) : null;
    },

    async create(customer: CustomerInput) {
      const created: Customer = { ...customer, id: customer.id || generateId() };
      await db.runAsync(
        `INSERT INTO customers (id, name, phone, address, note, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [created.id, created.name, created.phone, created.address, created.note, created.createdAt],
      );
      return created;
    },

    async update(customer) {
      await db.runAsync(
        `UPDATE customers SET name = ?, phone = ?, address = ?, note = ?
         WHERE id = ?`,
        [customer.name, customer.phone, customer.address, customer.note, customer.id],
      );
      return customer;
    },

    async remove(id) {
      await db.runAsync('DELETE FROM customers WHERE id = ?', id);
    },
  };
}