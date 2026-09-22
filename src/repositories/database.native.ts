import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { SEED_PRODUCTS } from '../data/seedProducts';
import { isValidSqlIdentifier } from './sqlIdentifier';

export const DATABASE_NAME = 'micaja.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLiteDatabase> {
  try {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await migrate(db);
    return db;
  } catch (err) {
    dbPromise = null;
    throw err;
  }
}

async function migrate(db: SQLiteDatabase): Promise<void> {
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
  number INTEGER NOT NULL UNIQUE,
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
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY NOT NULL,
  productId TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  movementType TEXT NOT NULL,
  referenceId TEXT,
  deviceId TEXT,
  synced INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_productId ON stock_movements (productId);
CREATE INDEX IF NOT EXISTS idx_stock_movements_createdAt ON stock_movements (createdAt);
CREATE INDEX IF NOT EXISTS idx_stock_movements_synced ON stock_movements (synced);
CREATE TABLE IF NOT EXISTS sync_state (
  id TEXT PRIMARY KEY NOT NULL,
  deviceId TEXT NOT NULL,
  businessId TEXT NOT NULL,
  lastSyncAt TEXT,
  lastServerCursor TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  updatedAt TEXT NOT NULL
);
`);

  await ensureColumn(db, 'products', 'provider', 'TEXT');
  await ensureColumn(db, 'products', 'providerPhone', 'TEXT');
  await ensureColumn(db, 'orders', 'voidedAt', 'TEXT');
  await ensureColumn(db, 'orders', 'voidReason', 'TEXT');
  await ensureColumn(db, 'products', 'updatedAt', 'TEXT');
  await ensureColumn(db, 'products', 'deletedAt', 'TEXT');
  await ensureColumn(db, 'customers', 'updatedAt', 'TEXT');
  await ensureColumn(db, 'customers', 'deletedAt', 'TEXT');
  await ensureColumn(db, 'providers', 'updatedAt', 'TEXT');
  await ensureColumn(db, 'providers', 'deletedAt', 'TEXT');
  await ensureColumn(db, 'orders', 'updatedAt', 'TEXT');
  await ensureColumn(db, 'orders', 'deletedAt', 'TEXT');

  await db.runAsync("UPDATE products SET updatedAt = createdAt WHERE updatedAt IS NULL OR updatedAt = ''");
  await db.runAsync("UPDATE customers SET updatedAt = createdAt WHERE updatedAt IS NULL OR updatedAt = ''");
  await db.runAsync("UPDATE providers SET updatedAt = createdAt WHERE updatedAt IS NULL OR updatedAt = ''");
  await db.runAsync("UPDATE orders SET updatedAt = createdAt WHERE updatedAt IS NULL OR updatedAt = ''");

  try {
    await db.execAsync('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_number_unique ON orders (number)');
  } catch {
  }

  await db.runAsync('UPDATE products SET trackStock = 1');

  const productCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM products');
  if (!productCount || productCount.count === 0) {
    for (const product of SEED_PRODUCTS) {
      await db.runAsync(
        `INSERT INTO products (id, name, priceCents, category, imageType, emoji, icon, imageUri, stockQuantity, active, provider, providerPhone, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          product.createdAt,
        ],
      );
    }
  }
}

async function ensureColumn(db: SQLiteDatabase, table: string, column: string, type: string): Promise<void> {
  if (!isValidSqlIdentifier(table) || !isValidSqlIdentifier(column)) {
    throw new Error(`Identificador SQL no válido: ${table}.${column}`);
  }
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

// Usado por "Eliminar cuenta" para devolver la base a su estado de fábrica:
// cierra conexiones y borra el archivo; la próxima llamada crea una BD limpia.
export async function deleteDatabaseFile(): Promise<void> {
  try {
    await SQLite.deleteDatabaseAsync(DATABASE_NAME);
  } finally {
    dbPromise = null;
  }
}

// Compacta el WAL en segundo plano: libera el espacio que el journal acumuló
// sin tocar la BD principal. Barato, seguro de llamar seguido.
export async function checkpointDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
}

// Reclama las páginas libres que quedaron al borrar productos/órdenes (freespace
// interno de la BD). Costoso: se ejecuta con moderación (ver storageMaintenance).
export async function vacuumDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('VACUUM;');
  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
}

// Poda el ledger append-only: una vez que un movimiento de stock fue entregado
// al servidor (synced = 1) y pasa la ventana de retención, no aporta nada local.
// Devuelve cuántas filas se borraron.
export async function pruneSyncedStockMovements(olderThanDays: number): Promise<number> {
  const db = await getDatabase();
  const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
  const result = await db.runAsync(
    'DELETE FROM stock_movements WHERE synced = 1 AND createdAt < ?',
    cutoff,
  );
  return result.changes ?? 0;
}