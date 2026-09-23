import { Platform } from 'react-native';
import type { Customer } from '../models/customer';
import { generateId } from '../utils/password';
import { enqueueSyncChange } from '../services/syncChangeQueue';
import { createSqliteCustomerRepository } from './sqliteCustomerRepository';

export type CustomerInput = Omit<Customer, 'id'> & { id?: string };

export interface CustomerRepository {
  list(): Promise<Customer[]>;
  listIncludingDeleted(): Promise<Customer[]>;
  getById(id: string): Promise<Customer | null>;
  create(customer: CustomerInput): Promise<Customer>;
  update(customer: Customer): Promise<Customer>;
  remove(id: string): Promise<void>;
  hardRemove(id: string): Promise<void>;
}

export function createInMemoryCustomerRepository(): CustomerRepository {
  let customers: Customer[] = [];

  const now = (): string => new Date().toISOString();

  return {
    async list() {
      return customers.filter((customer) => !customer.deletedAt);
    },

    async listIncludingDeleted() {
      return [...customers];
    },

    async getById(id) {
      const customer = customers.find((c) => c.id === id && !c.deletedAt);
      return customer ?? null;
    },

    async create(customer) {
      const created: Customer = {
        ...customer,
        id: customer.id || generateId(),
        updatedAt: customer.updatedAt ?? customer.createdAt ?? now(),
      };
      customers = [...customers, created];
      return created;
    },

    async update(customer) {
      const updated: Customer = { ...customer, updatedAt: now() };
      customers = customers.map((existing) =>
        existing.id === customer.id && !existing.deletedAt ? updated : existing,
      );
      return updated;
    },

    async remove(id) {
      const stamped = now();
      customers = customers.map((customer) =>
        customer.id === id && !customer.deletedAt
          ? { ...customer, deletedAt: stamped, updatedAt: stamped }
          : customer,
      );
    },

    async hardRemove(id) {
      customers = customers.filter((customer) => customer.id !== id);
    },
  };
}

class LazyCustomerRepository implements CustomerRepository {
  private implPromise: Promise<CustomerRepository> | null = null;

  reset(): void {
    this.implPromise = null;
  }

  private ready(): Promise<CustomerRepository> {
    if (!this.implPromise) {
      this.implPromise =
        Platform.OS === 'web'
          ? Promise.resolve(createInMemoryCustomerRepository())
          : createSqliteCustomerRepository();
    }
    return this.implPromise;
  }

  async list() {
    return (await this.ready()).list();
  }

  async listIncludingDeleted() {
    return (await this.ready()).listIncludingDeleted();
  }

  async getById(id: string) {
    return (await this.ready()).getById(id);
  }

  async create(customer: CustomerInput) {
    const created = await (await this.ready()).create(customer);
    await enqueueSyncChange('customer', created.id, 'upsert');
    return created;
  }

  async update(customer: Customer) {
    const updated = await (await this.ready()).update(customer);
    await enqueueSyncChange('customer', updated.id, 'upsert');
    return updated;
  }

  async remove(id: string) {
    await (await this.ready()).remove(id);
    await enqueueSyncChange('customer', id, 'delete');
  }

  async hardRemove(id: string) {
    await (await this.ready()).hardRemove(id);
    await enqueueSyncChange('customer', id, 'delete');
  }
}

export const customerRepository: CustomerRepository = new LazyCustomerRepository();

export function resetCustomerRepository(): void {
  (customerRepository as LazyCustomerRepository).reset();
}