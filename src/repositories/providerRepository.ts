import { Platform } from 'react-native';
import type { Provider } from '../models/provider';
import { generateId } from '../utils/password';
import { createSqliteProviderRepository } from './sqliteProviderRepository';

export type ProviderInput = Omit<Provider, 'id'> & { id?: string };

export interface ProviderRepository {
  list(): Promise<Provider[]>;
  listIncludingDeleted(): Promise<Provider[]>;
  getById(id: string): Promise<Provider | null>;
  create(provider: ProviderInput): Promise<Provider>;
  update(provider: Provider): Promise<Provider>;
  remove(id: string): Promise<void>;
  hardRemove(id: string): Promise<void>;
}

export function createInMemoryProviderRepository(): ProviderRepository {
  let providers: Provider[] = [];

  const now = (): string => new Date().toISOString();

  return {
    async list() {
      return providers.filter((provider) => !provider.deletedAt);
    },

    async listIncludingDeleted() {
      return [...providers];
    },

    async getById(id) {
      const provider = providers.find((p) => p.id === id && !p.deletedAt);
      return provider ?? null;
    },

    async create(provider) {
      const created: Provider = {
        ...provider,
        id: provider.id || generateId(),
        updatedAt: provider.updatedAt ?? provider.createdAt ?? now(),
      };
      providers = [...providers, created];
      return created;
    },

    async update(provider) {
      const updated: Provider = { ...provider, updatedAt: now() };
      providers = providers.map((existing) =>
        existing.id === provider.id && !existing.deletedAt ? updated : existing,
      );
      return updated;
    },

    async remove(id) {
      const stamped = now();
      providers = providers.map((provider) =>
        provider.id === id && !provider.deletedAt
          ? { ...provider, deletedAt: stamped, updatedAt: stamped }
          : provider,
      );
    },

    async hardRemove(id) {
      providers = providers.filter((provider) => provider.id !== id);
    },
  };
}

class LazyProviderRepository implements ProviderRepository {
  private implPromise: Promise<ProviderRepository> | null = null;

  reset(): void {
    this.implPromise = null;
  }

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

  async listIncludingDeleted() {
    return (await this.ready()).listIncludingDeleted();
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

  async hardRemove(id: string) {
    return (await this.ready()).hardRemove(id);
  }
}

export const providerRepository: ProviderRepository = new LazyProviderRepository();

export function resetProviderRepository(): void {
  (providerRepository as LazyProviderRepository).reset();
}