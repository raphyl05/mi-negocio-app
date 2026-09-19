import type { SQLiteDatabase } from 'expo-sqlite';
import type { Provider } from '../models/provider';
import { generateId } from '../utils/password';
import { getDatabase } from './database.native';
import type { ProviderInput, ProviderRepository } from './providerRepository';

type ProviderRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
  note: string;
  createdAt: string;
};

function rowToProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    note: row.note,
    createdAt: row.createdAt,
  };
}

export async function createSqliteProviderRepository(): Promise<ProviderRepository> {
  const db = await getDatabase();

  return {
    async list() {
      const rows = await db.getAllAsync<ProviderRow>('SELECT * FROM providers ORDER BY name COLLATE NOCASE ASC');
      return rows.map(rowToProvider);
    },

    async getById(id) {
      const row = await db.getFirstAsync<ProviderRow>('SELECT * FROM providers WHERE id = ?', id);
      return row ? rowToProvider(row) : null;
    },

    async create(provider: ProviderInput) {
      const created: Provider = { ...provider, id: provider.id || generateId() };
      await db.runAsync(
        `INSERT INTO providers (id, name, phone, address, note, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [created.id, created.name, created.phone, created.address, created.note, created.createdAt],
      );
      return created;
    },

    async update(provider) {
      await db.runAsync(
        `UPDATE providers SET name = ?, phone = ?, address = ?, note = ?
         WHERE id = ?`,
        [provider.name, provider.phone, provider.address, provider.note, provider.id],
      );
      return provider;
    },

    async remove(id) {
      await db.runAsync('DELETE FROM providers WHERE id = ?', id);
    },
  };
}