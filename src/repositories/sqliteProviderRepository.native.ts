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
  updatedAt: string | null;
  deletedAt: string | null;
};

function rowToProvider(row: ProviderRow): Provider {
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

export async function createSqliteProviderRepository(): Promise<ProviderRepository> {
  const db = await getDatabase();

  return {
    async list() {
      const rows = await db.getAllAsync<ProviderRow>(
        'SELECT * FROM providers WHERE deletedAt IS NULL ORDER BY name COLLATE NOCASE ASC',
      );
      return rows.map(rowToProvider);
    },

    async listIncludingDeleted() {
      const rows = await db.getAllAsync<ProviderRow>(
        'SELECT * FROM providers ORDER BY name COLLATE NOCASE ASC',
      );
      return rows.map(rowToProvider);
    },

    async getById(id) {
      const row = await db.getFirstAsync<ProviderRow>(
        'SELECT * FROM providers WHERE id = ? AND deletedAt IS NULL',
        id,
      );
      return row ? rowToProvider(row) : null;
    },

    async create(provider: ProviderInput) {
      const created: Provider = {
        ...provider,
        id: provider.id || generateId(),
        updatedAt: provider.updatedAt ?? provider.createdAt,
      };
      await db.runAsync(
        `INSERT INTO providers (id, name, phone, address, note, createdAt, updatedAt)
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

    async update(provider) {
      const updatedAt = new Date().toISOString();
      await db.runAsync(
        `UPDATE providers SET name = ?, phone = ?, address = ?, note = ?, updatedAt = ?
         WHERE id = ? AND deletedAt IS NULL`,
        [provider.name, provider.phone, provider.address, provider.note, updatedAt, provider.id],
      );
      return { ...provider, updatedAt };
    },

    async remove(id) {
      const stamped = new Date().toISOString();
      await db.runAsync(
        'UPDATE providers SET deletedAt = ?, updatedAt = ? WHERE id = ? AND deletedAt IS NULL',
        stamped,
        stamped,
        id,
      );
    },

    async hardRemove(id) {
      await db.runAsync('DELETE FROM providers WHERE id = ?', id);
    },
  };
}