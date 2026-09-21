import type { Business } from '../models/business';
import type { CashRegister } from '../models/cashRegister';
import type { CashClosureRecord } from '../services/cashRegisterService';
import type { Customer } from '../models/customer';
import type { Order } from '../models/order';
import type { Product } from '../models/product';
import type { Provider } from '../models/provider';
import type { User } from '../models/user';
import type { PrinterConfig } from '../services/printer/types';

export type SanitizedUser = {
  id: string;
  username: string;
  createdAt: string;
};

export function sanitizeUserForBackup(user: User | null): SanitizedUser | null {
  if (!user) return null;
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

export type BackupBundle = {
  app: 'vendelo';
  version: 1;
  exportedAt: string;
  business: Business | null;
  user: SanitizedUser | null;
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

const ORDER_STATUSES = new Set(['pending', 'paid', 'voided']);
const PAYMENT_METHODS = new Set(['cash', 'transfer']);
const PRODUCT_IMAGE_TYPES = new Set(['emoji', 'icon', 'photo']);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStr(v: unknown): v is string {
  return typeof v === 'string';
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isIsoDate(v: unknown): v is string {
  return isStr(v) && !Number.isNaN(Date.parse(v));
}

function firstArrayIssue(
  items: unknown,
  label: string,
  check: (item: unknown, index: number) => string | null,
): string | null {
  if (!Array.isArray(items)) return `"${label}" debe ser una lista.`;
  for (let i = 0; i < items.length; i++) {
    const issue = check(items[i], i);
    if (issue) return issue;
  }
  return null;
}

function productIssue(item: unknown, index: number): string | null {
  const n = `Producto #${index + 1}`;
  if (!isObject(item)) return `${n} no es un objeto válido.`;
  if (!isStr(item.id) || !item.id) return `${n}: falta "id".`;
  if (!isStr(item.name) || !item.name) return `${n}: falta "name".`;
  if (!isNum(item.priceCents) || item.priceCents < 0) return `${n}: "priceCents" no es un monto válido.`;
  if (!isNum(item.stockQuantity)) return `${n}: "stockQuantity" no es un número válido.`;
  if (!isStr(item.category)) return `${n}: falta "category".`;
  if (!PRODUCT_IMAGE_TYPES.has(item.imageType as string)) return `${n}: "imageType" no es válido.`;
  if (typeof item.active !== 'boolean') return `${n}: "active" no es booleano.`;
  if (!isIsoDate(item.createdAt)) return `${n}: "createdAt" no es una fecha válida.`;
  return null;
}

function orderIssue(item: unknown, index: number): string | null {
  const n = `Orden #${index + 1}`;
  if (!isObject(item)) return `${n} no es un objeto válido.`;
  if (!isStr(item.id) || !item.id) return `${n}: falta "id".`;
  if (!isNum(item.number) || !Number.isInteger(item.number) || item.number < 1) return `${n}: "number" no es válido.`;
  if (!ORDER_STATUSES.has(item.status as string)) return `${n}: estado "${String(item.status)}" no válido.`;
  if (!Array.isArray(item.items) || item.items.length === 0) return `${n}: "items" debe ser una lista no vacía.`;
  for (const line of item.items) {
    if (!isObject(line) || !isObject(line.product)) return `${n}: línea de ítem no válida.`;
    const p = line.product as Record<string, unknown>;
    if (!isStr(p.id) || !isStr(p.name)) return `${n}: ítem sin "id"/"name".`;
    if (!isNum(p.priceCents) || p.priceCents < 0) return `${n}: ítem sin precio válido.`;
    if (!isNum(line.quantity) || !Number.isInteger(line.quantity) || line.quantity < 1) return `${n}: cantidad de ítem no válida.`;
  }
  if (!isNum(item.subtotalCents) || item.subtotalCents < 0) return `${n}: "subtotalCents" no es válido.`;
  if (!isObject(item.customer)) return `${n}: "customer" no es válido.`;
  const c = item.customer as Record<string, unknown>;
  for (const field of ['customerName', 'phone', 'address', 'description']) {
    if (!isStr(c[field])) return `${n}: falta "customer.${field}".`;
  }
  if (item.status === 'paid') {
    if (item.paymentMethod !== undefined && !PAYMENT_METHODS.has(item.paymentMethod as string)) {
      return `${n}: método de pago no válido.`;
    }
    if (isNum(item.receivedCents) && isNum(item.changeCents) && (item.receivedCents as number) < (item.changeCents as number)) {
      return `${n}: el cambio no puede ser mayor que lo recibido.`;
    }
  }
  if (!isIsoDate(item.createdAt)) return `${n}: "createdAt" no es una fecha válida.`;
  if (item.paidAt !== undefined && !isIsoDate(item.paidAt)) return `${n}: "paidAt" no es una fecha válida.`;
  if (item.voidedAt !== undefined && !isIsoDate(item.voidedAt)) return `${n}: "voidedAt" no es una fecha válida.`;
  return null;
}

function customerProviderIssue(item: unknown, index: number, label: string): string | null {
  const n = `${label} #${index + 1}`;
  if (!isObject(item)) return `${n} no es un objeto válido.`;
  if (!isStr(item.id) || !item.id) return `${n}: falta "id".`;
  if (!isStr(item.name) || !item.name) return `${n}: falta "name".`;
  if (!isIsoDate(item.createdAt)) return `${n}: "createdAt" no es una fecha válida.`;
  return null;
}

function closureIssue(item: unknown, index: number): string | null {
  const n = `Cierre de caja #${index + 1}`;
  if (!isObject(item)) return `${n} no es un objeto válido.`;
  if (!isStr(item.id) || !item.id) return `${n}: falta "id".`;
  if (!isIsoDate(item.closedAt)) return `${n}: "closedAt" no es una fecha válida.`;
  for (const field of ['openingAmountCents', 'expectedCashCents', 'countedCashCents', 'differenceCents']) {
    if (!isNum(item[field])) return `${n}: "${field}" no es un monto válido.`;
  }
  return null;
}

function registerIssue(register: unknown): string | null {
  if (!isObject(register)) return 'La caja abierta no es un objeto válido.';
  if (!isStr(register.id) || !register.id) return 'La caja abierta: falta "id".';
  if (!isNum(register.openingAmountCents)) return 'La caja abierta: "openingAmountCents" no es válido.';
  if (!isIsoDate(register.openedAt)) return 'La caja abierta: "openedAt" no es una fecha válida.';
  return null;
}

export function validateBackupData(candidate: unknown): string | null {
  if (!isObject(candidate)) return 'El archivo no tiene la estructura esperada.';
  let issue = firstArrayIssue(candidate.products ?? [], 'productos', productIssue);
  if (issue) return issue;
  issue = firstArrayIssue(candidate.orders ?? [], 'órdenes', orderIssue);
  if (issue) return issue;
  issue = firstArrayIssue(candidate.customers ?? [], 'clientes', (it, i) => customerProviderIssue(it, i, 'Cliente'));
  if (issue) return issue;
  issue = firstArrayIssue(candidate.providers ?? [], 'proveedores', (it, i) => customerProviderIssue(it, i, 'Proveedor'));
  if (issue) return issue;
  issue = firstArrayIssue(candidate.cashClosures ?? [], 'cierres de caja', closureIssue);
  if (issue) return issue;
  if (candidate.cashRegister !== null && candidate.cashRegister !== undefined) {
    issue = registerIssue(candidate.cashRegister);
    if (issue) return issue;
  }
  return null;
}

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
  const invalid = validateBackupData(parsed);
  if (invalid) {
    return { ok: false, message: `Respaldo no válido: ${invalid}` };
  }
  const bundle: BackupBundle = {
    app: 'vendelo',
    version: 1,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : new Date().toISOString(),
    business: (candidate.business as Business | null | undefined) ?? null,
    user: (candidate.user as SanitizedUser | null | undefined) ?? null,
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
