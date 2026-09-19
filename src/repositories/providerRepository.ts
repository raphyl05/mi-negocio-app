import { Platform } from 'react-native';
import type { Provider } from '../models/provider';
import { generateId } from '../utils/password';
import { createSqliteProviderRepository } from './sqliteProviderRepository';

export type ProviderInput = Omit<Provider, 'id'> & { id?: string };

export interface ProviderRepository {
  list(): Promise<Provider[]>;
  getById(id: string): Promise<Provider | null>;
  create(provider: ProviderInput): Promise<Provider>;
  update(provider: Provider): Promise<Provider>;
  remove(id: string): Promise<void>;
}

export function createInMemoryProviderRepository(): ProviderRepository {
  let providers: Provider[] = [];

  return {
    async list() {
      return [...providers];
    },

    async getById(id) {
      return providers.find((provider) => provider.id === id) ?? null;
    },

    async create(provider) {
      const created: Provider = { ...provider, id: provider.id || generateId() };
      providers = [...providers, created];
      return created;
    },

    async update(provider) {
      providers = providers.map((existing) => (existing.id === provider.id ? provider : existing));
      return provider;
    },

    async remove(id) {
      providers = providers.filter((provider) => provider.id !== id);
    },
  };
}

class LazyProviderRepository implements ProviderRepository {
  private implPromise: Promise<ProviderRepository> | null = null;

  private ready(): Promise<ProviderRepository> {
    if (!this.implPromise) {
      this.implPromise =
        Platform.OS === 'web'
          ? Promise.resolve(createInMemoryProviderRepository())
          : createSqliteProviderRepository();
    }
    return this.implPromise;
  }

  async list() {
    return (await this.ready()).list();
  }

  async getById(id: string) {
    return (await this.ready()).getById(id);
  }

  async create(provider: ProviderInput) {
    return (await this.ready()).create(provider);
  }

  async update(provider: Provider) {
    return (await this.ready()).update(provider);
  }

  async remove(id: string) {
    return (await this.ready()).remove(id);
  }
}

export const providerRepository: ProviderRepository = new LazyProviderRepository();