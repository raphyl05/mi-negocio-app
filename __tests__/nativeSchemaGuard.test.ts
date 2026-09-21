import { readFileSync } from 'fs';
import { join } from 'path';

const projectRoot = join(__dirname, '..');
const readSrc = (rel: string) => readFileSync(join(projectRoot, 'src', rel), 'utf8');

const migrationSource = readSrc('repositories/database.native.ts');

function createdColumns(table: string): Set<string> {
  const block = migrationSource.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\)`));
  const columns = new Set<string>();
  const matches = Array.from(block?.[1].matchAll(/([A-Za-z_]+)\s+(TEXT|INTEGER|REAL|BLOB|NUMERIC)/g) ?? []);
  for (const match of matches) columns.add(match[1]);
  return columns;
}

function ensuredColumns(table: string): Set<string> {
  const regex = new RegExp(`ensureColumn\\s*\\(\\s*db\\s*,\\s*'${table}'\\s*,\\s*'([A-Za-z_]+)'`, 'g');
  const columns = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(migrationSource)) !== null) columns.add(match[1]);
  return columns;
}

const dynamicColumns: Record<string, string[]> = {
  products: ['updatedAt', 'deletedAt', 'provider', 'providerPhone'],
  orders: ['updatedAt', 'deletedAt', 'voidedAt', 'voidReason'],
  customers: ['updatedAt', 'deletedAt'],
  providers: ['updatedAt', 'deletedAt'],
};

const repos: Array<[string, string]> = [
  ['repositories/sqliteProductRepository.native.ts', 'products'],
  ['repositories/sqliteOrderRepository.native.ts', 'orders'],
  ['repositories/sqliteCustomerRepository.native.ts', 'customers'],
  ['repositories/sqliteProviderRepository.native.ts', 'providers'],
];

describe('esquema SQLite nativo: toda columna que los repos usan existe en migrate()', () => {
  it('orders.deletedAt se crea en la migración (regresión de producción)', () => {
    expect(ensuredColumns('orders')).toContain('deletedAt');
  });

  for (const [file, table] of repos) {
    it(`${file} solo referencia columnas que la migración crea o asegura`, () => {
      const source = readSrc(file);
      const available = new Set<string>([...createdColumns(table), ...ensuredColumns(table)]);
      const used = new Set<string>();
      const pattern = new RegExp(`\\b(${dynamicColumns[table].join('|')})\\b`, 'g');
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) used.add(match[1]);
      for (const column of used) {
        expect(available).toContain(column);
      }
    });
  }
});