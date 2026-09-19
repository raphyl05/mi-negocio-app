import type { Business } from '../models/business';
import type { CashRegister } from '../models/cashRegister';
import type { CashClosureRecord } from '../services/cashRegisterService';
import type { Customer } from '../models/customer';
import type { Order } from '../models/order';
import type { Product } from '../models/product';
import type { Provider } from '../models/provider';
import type { User } from '../models/user';
import type { PrinterConfig } from '../services/printer/types';

export type BackupBundle = {
  app: 'vendelo';
  version: 1;
  exportedAt: string;
  business: Business | null;
  user: User | null;
  cashRegister: CashRegister | null;
  cashClosures: CashClosureRecord[] | null;
  printer: PrinterConfig | null;
  products: Product[];
  orders: Order[];
  customers: Customer[];
  providers: Provider[];
};

export function serializeBackup(bundle: BackupBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function deriveNextOrderNumber(orders: Order[]): number {
  if (orders.length === 0) return 1;
  return Math.max(...orders.map((o) => o.number)) + 1;
}

export type ParseResult =
  | { ok: true; bundle: BackupBundle }
  | { ok: false; message: string };

export function parseBackup(json: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, message: 'El archivo no es un JSON válido.' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, message: 'El archivo no tiene la estructura esperada.' };
  }
  const candidate = parsed as Record<string, unknown>;
  if (candidate.app !== 'vendelo') {
    return { ok: false, message: 'Archivo no pertenece a Vendelo App.' };
  }
  if (candidate.version !== 1) {
    return { ok: false, message: `Versión de respaldo no compatible (${String(candidate.version)}).` };
  }
  const bundle: BackupBundle = {
    app: 'vendelo',
    version: 1,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : new Date().toISOString(),
    business: (candidate.business as Business | null | undefined) ?? null,
    user: (candidate.user as User | null | undefined) ?? null,
    cashRegister: (candidate.cashRegister as CashRegister | null | undefined) ?? null,
    cashClosures: Array.isArray(candidate.cashClosures) ? (candidate.cashClosures as CashClosureRecord[]) : null,
    printer: (candidate.printer as PrinterConfig | null | undefined) ?? null,
    products: Array.isArray(candidate.products) ? (candidate.products as Product[]) : [],
    orders: Array.isArray(candidate.orders) ? (candidate.orders as Order[]) : [],
    customers: Array.isArray(candidate.customers) ? (candidate.customers as Customer[]) : [],
    providers: Array.isArray(candidate.providers) ? (candidate.providers as Provider[]) : [],
  };
  return { ok: true, bundle };
}
