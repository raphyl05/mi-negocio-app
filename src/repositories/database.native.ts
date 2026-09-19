import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { SEED_PRODUCTS } from '../data/seedProducts';

export const DATABASE_NAME = 'micaja.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await db.execAsync(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  priceCents INTEGER NOT NULL,
  category TEXT NOT NULL,
  imageType TEXT NOT NULL DEFAULT 'emoji',
  emoji TEXT,
  icon TEXT,
  imageUri TEXT,
  trackStock INTEGER NOT NULL DEFAULT 1,
  stockQuantity INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  provider TEXT,
  providerPhone TEXT,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY NOT NULL,
  number INTEGER NOT NULL,
  items TEXT NOT NULL,
  subtotalCents INTEGER NOT NULL,
  customerName TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  paymentMethod TEXT,
  receivedCents INTEGER,
  changeCents INTEGER,
  createdAt TEXT NOT NULL,
  paidAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders (createdAt);
CREATE TABLE IF NOT EXISTS order_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_providers_name ON providers (name);
`);

  await ensureColumn(db, 'products', 'provider', 'TEXT');
  await ensureColumn(db, 'products', 'providerPhone', 'TEXT');

  await db.runAsync('UPDATE products SET trackStock = 1');

  const productCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM products');
  if (!productCount || productCount.count === 0) {
    for (const product of SEED_PRODUCTS) {
      await db.runAsync(
        `INSERT INTO products (id, name, priceCents, category, imageType, emoji, icon, imageUri, stockQuantity, active, provider, providerPhone, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.id,
          product.name,
          product.priceCents,
          product.category,
          product.imageType,
          product.emoji ?? null,
          product.icon ?? null,
          product.imageUri ?? null,
          product.stockQuantity,
          product.active ? 1 : 0,
          product.provider ?? null,
          product.providerPhone ?? null,
          product.createdAt,
        ],
      );
    }
  }

  return db;
}

async function ensureColumn(db: SQLiteDatabase, table: string, column: string, type: string): Promise<void> {
  const rows = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  if (!rows.some((row) => row.name === column)) {
    await db.runAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

export async function getNextOrderNumber(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM order_meta WHERE key = 'nextNumber'`,
  );
  return row ? parseInt(row.value, 10) : 1;
}

export async function setNextOrderNumber(db: SQLiteDatabase, next: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO order_meta (key, value) VALUES ('nextNumber', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    String(next),
  );
}