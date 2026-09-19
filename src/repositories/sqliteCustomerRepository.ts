import type { CustomerRepository } from './customerRepository';
import { createInMemoryCustomerRepository } from './customerRepository';

export async function createSqliteCustomerRepository(): Promise<CustomerRepository> {
  return createInMemoryCustomerRepository();
}