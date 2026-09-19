import type { ProviderRepository } from './providerRepository';
import { createInMemoryProviderRepository } from './providerRepository';

export async function createSqliteProviderRepository(): Promise<ProviderRepository> {
  return createInMemoryProviderRepository();
}