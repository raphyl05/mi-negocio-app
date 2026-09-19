import type { Product } from '../models/product';
import { generateId } from '../utils/password';
import { getDatabase } from './database.native';
import type { ProductRepository } from './productRepository';

type ProductRow = {
  id: string;
  name: string;
  priceCents: number;
  category: string;
  imageType: Product['imageType'];
  emoji: string | null;
  icon: string | null;
  imageUri: string | null;
  trackStock: number;
  stockQuantity: number;
  active: number;
  provider: string | null;
  providerPhone: string | null;
  createdAt: string;
};

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.priceCents,
    category: row.category,
    imageType: row.imageType,
    emoji: row.emoji ?? undefined,
    icon: row.icon ?? undefined,
    imageUri: row.imageUri ?? undefined,
    trackStock: row.trackStock === 1,
    stockQuantity: row.stockQuantity,
    active: row.active === 1,
    provider: row.provider ?? undefined,
    providerPhone: row.providerPhone ?? undefined,
    createdAt: row.createdAt,
  };
}

export async function createSqliteProductRepository(): Promise<ProductRepository> {
  const db = await getDatabase();

  return {
    async list() {
      const rows = await db.getAllAsync<ProductRow>('SELECT * FROM products ORDER BY createdAt ASC');
      return rows.map(rowToProduct);
    },

    async listByCategory(category) {
      const rows = await db.getAllAsync<ProductRow>('SELECT * FROM products WHERE category = ? ORDER BY createdAt ASC', category);
      return rows.map(rowToProduct);
    },

    async getById(id) {
      const row = await db.getFirstAsync<ProductRow>('SELECT * FROM products WHERE id = ?', id);
      return row ? rowToProduct(row) : null;
    },

    async create(product) {
      const created: Product = { ...product, id: product.id || generateId() };
      await db.runAsync(
        `INSERT INTO products (id, name, priceCents, category, imageType, emoji, icon, imageUri, trackStock, stockQuantity, active, provider, providerPhone, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          created.id,
          created.name,
          created.priceCents,
          created.category,
          created.imageType,
          created.emoji ?? null,
          created.icon ?? null,
          created.imageUri ?? null,
          created.trackStock ? 1 : 0,
          created.stockQuantity,
          created.active ? 1 : 0,
          created.provider ?? null,
          created.providerPhone ?? null,
          created.createdAt,
        ],
      );
      return created;
    },

    async update(product) {
      await db.runAsync(
        `UPDATE products SET name = ?, priceCents = ?, category = ?, imageType = ?, emoji = ?, icon = ?, imageUri = ?, trackStock = ?, stockQuantity = ?, active = ?, provider = ?, providerPhone = ?
         WHERE id = ?`,
        [
          product.name,
          product.priceCents,
          product.category,
          product.imageType,
          product.emoji ?? null,
          product.icon ?? null,
          product.imageUri ?? null,
          product.trackStock ? 1 : 0,
          product.stockQuantity,
          product.active ? 1 : 0,
          product.provider ?? null,
          product.providerPhone ?? null,
          product.id,
        ],
      );
      return product;
    },

    async remove(id) {
      await db.runAsync('DELETE FROM products WHERE id = ?', id);
    },

    async removeByCategory(category) {
      const result = await db.getFirstAsync<{ n: number }>(
        'SELECT count(*) as n FROM products WHERE category = ?',
        category,
      );
      await db.runAsync('DELETE FROM products WHERE category = ?', category);
      return result?.n ?? 0;
    },

    async decreaseStock(id, quantity) {
      await db.runAsync(
        'UPDATE products SET stockQuantity = MAX(0, stockQuantity - ?) WHERE id = ?',
        quantity,
        id,
      );
    },
  };
}