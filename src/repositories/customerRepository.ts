import { Platform } from 'react-native';
import type { Customer } from '../models/customer';
import { generateId } from '../utils/password';
import { createSqliteCustomerRepository } from './sqliteCustomerRepository';

export type CustomerInput = Omit<Customer, 'id'> & { id?: string };

export interface CustomerRepository {
  list(): Promise<Customer[]>;
  getById(id: string): Promise<Customer | null>;
  create(customer: CustomerInput): Promise<Customer>;
  update(customer: Customer): Promise<Customer>;
  remove(id: string): Promise<void>;
}

export function createInMemoryCustomerRepository(): CustomerRepository {
  let customers: Customer[] = [];

  return {
    async list() {
      return [...customers];
    },

    async getById(id) {
      return customers.find((customer) => customer.id === id) ?? null;
    },

    async create(customer) {
      const created: Customer = { ...customer, id: customer.id || generateId() };
      customers = [...customers, created];
      return created;
    },

    async update(customer) {
      customers = customers.map((existing) => (existing.id === customer.id ? customer : existing));
      return customer;
    },

    async remove(id) {
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

  async getById(id: string) {
    return (await this.ready()).getById(id);
  }

  async create(customer: CustomerInput) {
    return (await this.ready()).create(customer);
  }

  async update(customer: Customer) {
    return (await this.ready()).update(customer);
  }

  async remove(id: string) {
    return (await this.ready()).remove(id);
  }
}

export const customerRepository: CustomerRepository = new LazyCustomerRepository();

export function resetCustomerRepository(): void {
  (customerRepository as LazyCustomerRepository).reset();
}