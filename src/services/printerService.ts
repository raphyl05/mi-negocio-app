import { AppState } from 'react-native';
import type { Order, PaymentMethod } from '../models/order';
import type { Business } from '../models/business';
import { formatDate, formatTime } from '../utils/datetime';
import { invoiceCodeFor } from '../utils/invoice';
import { formatMoney } from '../utils/money';
import {
  mergePrinterConfig,
  loadPrinterConfig,
} from './printer/printerConfigStore';
import { transportByKind, transports } from './printer/transports/printerTransport';
import type { PrinterTransport } from './printer/transports/printerTransport';
import { buildTestPrintText } from './printer/escpos';
import type {
  DiscoveredPrinter,
  PrintPayload,
  PrintResult,
  PrinterConfig,
  PrinterState,
  PrinterStatus,
  PrinterTransportInfo,
} from './printer/types';

export type PrintTicketLine = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type PrintTicket = {
  businessName: string;
  businessPhone?: string;
  businessAddress?: string;
  logoBase64?: string;
  orderNumber: number;
  createdAt: string;
  status: Order['status'];
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerDescription?: string;
  lines: PrintTicketLine[];
  subtotalCents: number;
  paymentMethod?: PaymentMethod;
  receivedCents?: number;
  changeCents?: number;
};

export type { PrintResult };

export interface PrinterService {
  readonly available: boolean;
  readonly label: string;
  print(ticket: PrintTicket): Promise<PrintResult>;
}

export function buildTicket(order: Order, business: Business): PrintTicket {
  return {
    businessName: business.name,
    businessPhone: business.phone,
    businessAddress: business.address,
    logoBase64: business.logoBase64,
    orderNumber: order.number,
    createdAt: order.paidAt ?? order.createdAt,
    status: order.status,
    customerName: order.customer.customerName,
    customerPhone: order.customer.phone,
    customerAddress: order.customer.address,
    customerDescription: order.customer.description,
    lines: order.items.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      unitPriceCents: item.product.priceCents,
    })),
    subtotalCents: order.subtotalCents,
    paymentMethod: order.paymentMethod,
    receivedCents: order.receivedCents,
    changeCents: order.changeCents,
  };
}

export function logoDataUri(logoBase64?: string): string | null {
  if (!logoBase64) return null;
  return `data:image/png;base64,${logoBase64}`;
}

export function renderTicketText(ticket: PrintTicket): string {
  const divider = '-'.repeat(42);
  const money = (cents: number) => formatMoney(cents);
  const methodLabel =
    ticket.paymentMethod === 'cash'
      ? 'Efectivo'
      : ticket.paymentMethod === 'transfer'
        ? 'Transferencia'
        : 'Pendiente';

  const lines: string[] = [];
  lines.push(ticket.businessName.toUpperCase());
  if (ticket.businessPhone) {
    lines.push(`Tel: ${ticket.businessPhone}`);
  }
  if (ticket.businessAddress) {
    lines.push(ticket.businessAddress);
  }
  lines.push(divider);
  lines.push(ticket.status === 'paid' ? `Factura ${invoiceCodeFor(ticket.orderNumber)}` : `Factura ${invoiceCodeFor(ticket.orderNumber)} (PENDIENTE)`);
  lines.push(`${formatDate(ticket.createdAt)}  ${formatTime(ticket.createdAt)}`);
  if (ticket.customerName.trim()) {
    lines.push(`Cliente: ${ticket.customerName.trim()}`);
  }
  if (ticket.customerPhone?.trim()) {
    lines.push(`Tel: ${ticket.customerPhone.trim()}`);
  }
  if (ticket.customerAddress?.trim()) {
    lines.push(`Direccion: ${ticket.customerAddress.trim()}`);
  }
  if (ticket.customerDescription?.trim()) {
    lines.push(`Nota: ${ticket.customerDescription.trim()}`);
  }
  lines.push(divider);
  for (const line of ticket.lines) {
    lines.push(line.name);
    lines.push(`  ${line.quantity} x ${money(line.unitPriceCents)}`.padEnd(22) + money(line.unitPriceCents * line.quantity));
  }
  lines.push(divider);
  lines.push('TOTAL'.padEnd(26) + money(ticket.subtotalCents));
  lines.push(divider);
  lines.push(`Metodo de pago: ${methodLabel}`);
  if (ticket.receivedCents !== undefined) {
    lines.push(`Recibido: ${money(ticket.receivedCents)}`);
  }
  if (ticket.changeCents !== undefined && ticket.changeCents > 0) {
    lines.push(`Cambio: ${money(ticket.changeCents)}`);
  }
  lines.push('');
  lines.push('¡Gracias por su compra!');
  if (ticket.status === 'pending') {
    lines.push('');
    lines.push('*** PAGO PENDIENTE ***');
  }
  return lines.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildHtmlFromText(text: string, logoUri?: string | null): string {
  const brand = 'Vendelo App';
  const logo = logoUri ? `<img src="${logoUri}" style="width:64px;height:64px;object-fit:contain;" />` : '';
  return [
    '<!doctype html><html><head><meta charset="utf-8" /><title>Imprimir</title><style>',
    'body{font-family:monospace;margin:0;padding:16px;color:#000;}',
    'pre{white-space:pre-wrap;font-family:monospace;font-size:13px;line-height:1.45;}',
    'h1{font-size:16px;margin:8px 0;}',
    '</style></head><body>',
    logo,
    `<h1>${escapeHtml(brand)}</h1>`,
    `<pre>${escapeHtml(text)}</pre>`,
    '</body></html>',
  ].join('\n');
}

export function buildTicketHtml(ticket: PrintTicket): string {
  return buildHtmlFromText(renderTicketText(ticket), logoDataUri(ticket.logoBase64));
}

const RECONNECT_INTERVAL_MS = 15000;

export class PrinterController {
  private config: PrinterConfig = { enabled: false };
  private status: PrinterStatus = {
    enabled: false,
    state: 'idle',
    label: 'Impresora no configurada',
    ready: false,
  };
  private listeners = new Set<() => void>();
  private watcher: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove(): void } | null = null;
  private initialized = false;

  get available(): boolean {
    return this.status.enabled && this.status.state === 'connected';
  }

  get label(): string {
    return this.status.label;
  }

  getStatus(): PrinterStatus {
    return { ...this.status };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(partial: Partial<PrinterStatus>): void {
    this.status = { ...this.status, ...partial };
    this.listeners.forEach((listener) => listener());
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const saved = await loadPrinterConfig();
    if (saved) {
      this.config = saved;
      this.setStatus({ enabled: saved.enabled });
    }
    this.appStateSubscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        this.ensureConnected();
      }
    });
    this.startWatcher();
    if (this.config.enabled) {
      await this.ensureConnected();
    }
  }

  private startWatcher(): void {
    if (this.watcher) return;
    this.watcher = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      if (!this.config.enabled) return;
      this.ensureConnected();
    }, RECONNECT_INTERVAL_MS);
  }

  // Reconecta automáticamente si la impresora configurada volvió a aparecer
  // (se apagó y se encendió, o se perdió el enlace). Es idempotente.
  async ensureConnected(): Promise<void> {
    if (!this.config.enabled || !this.config.type) return;
    if (this.status.state === 'connecting' || this.status.state === 'connected') return;
    const transport = transportByKind(this.config.type);
    const isAlive = await transport.isConnected();
    if (isAlive) {
      this.setStatus({
        state: 'connected',
        ready: true,
        name: this.config.name,
        type: this.config.type,
        label: `${this.config.name ?? 'Impresora'} lista`,
      });
      return;
    }
    this.setStatus({ state: 'connecting', ready: false, type: this.config.type });
    try {
      await transport.connect({ name: this.config.name, address: this.config.address });
      this.config = await mergePrinterConfig({ ...this.config, connectedAt: new Date().toISOString() });
      this.setStatus({
        state: 'connected',
        ready: true,
        name: this.config.name,
        type: this.config.type,
        label: `${this.config.name ?? 'Impresora'} lista`,
      });
    } catch {
      this.setStatus({
        state: 'error',
        ready: false,
        type: this.config.type,
        label: `${this.config.name ?? 'Impresora'} sin conexión`,
      });
    }
  }

  async discover(): Promise<DiscoveredPrinter[]> {
    const found = await Promise.all(
      transports().map((transport) => transport.discover().catch(() => [] as DiscoveredPrinter[])),
    );
    const byId = new Map<string, DiscoveredPrinter>();
    for (const device of found.flat()) {
      if (!byId.has(device.id)) byId.set(device.id, device);
    }
    return Array.from(byId.values());
  }

  transportInfo(): PrinterTransportInfo[] {
    return transports().map((transport) => transport.info());
  }

  async connect(printer: DiscoveredPrinter): Promise<PrintResult> {
    const transport = transportByKind(printer.type);
    this.setStatus({ state: 'connecting', ready: false, type: printer.type, name: printer.name, label: `Conectando a ${printer.name}…` });
    try {
      await transport.connect({ name: printer.name, address: printer.address });
      this.config = await mergePrinterConfig({
        enabled: true,
        type: printer.type,
        name: printer.name,
        address: printer.address,
        connectedAt: new Date().toISOString(),
      });
      this.setStatus({ enabled: true, state: 'connected', ready: true, name: printer.name, type: printer.type, label: `${printer.name} lista` });
      return { ok: true, message: `Conectada: ${printer.name}` };
    } catch (error) {
      this.setStatus({
        state: 'error',
        ready: false,
        type: printer.type,
        name: printer.name,
        label: `No se pudo conectar ${printer.name}`,
      });
      return {
        ok: false,
        message: error instanceof Error ? error.message : `No se pudo conectar ${printer.name}.`,
      };
    }
  }

  async setEnabled(enabled: boolean): Promise<PrintResult> {
    this.config = await mergePrinterConfig({ enabled });
    if (!enabled) {
      const transport = transportByKind(this.config.type);
      await transport.disconnect().catch(() => undefined);
      this.setStatus({ enabled: false, state: 'idle', ready: false, label: 'Impresora apagada' });
      return { ok: true, message: 'Impresora desactivada.' };
    }
    this.setStatus({ enabled: true });
    if (!this.config.type) {
      this.setStatus({ state: 'error', ready: false, label: 'Elige una impresora en Configuración → Impresora' });
      return { ok: false, message: 'Aún no has elegido una impresora.' };
    }
    await this.ensureConnected();
    return { ok: true, message: 'Impresora activada.' };
  }

  async disconnect(): Promise<void> {
    const transport = transportByKind(this.config.type);
    await transport.disconnect().catch(() => undefined);
    this.config = await mergePrinterConfig({ enabled: false });
    this.setStatus({ enabled: false, state: 'idle', ready: false, label: 'Impresora desconectada' });
  }

  private currentTransport(): PrinterTransport | null {
    if (!this.config.enabled || !this.config.type) return null;
    return transportByKind(this.config.type);
  }

  private async printPayload(payload: PrintPayload): Promise<PrintResult> {
    const transport = this.currentTransport();
    if (!transport) {
      return { ok: false, message: 'Activa la impresora en Configuración → Impresora.' };
    }
    if (this.status.state !== 'connected') {
      await this.ensureConnected();
    }
    if (this.status.state !== 'connected') {
      return { ok: false, message: this.status.label };
    }
    const result = await transport.print(payload);
    if (!result.ok) {
      this.setStatus({ state: 'error', ready: false, label: `${this.config.name ?? 'Impresora'} sin conexión` });
    }
    return result;
  }

  async print(ticket: PrintTicket): Promise<PrintResult> {
    return this.printPayload({ text: renderTicketText(ticket), html: buildTicketHtml(ticket), logoUri: logoDataUri(ticket.logoBase64) });
  }

  async printOrder(order: Order, business: Business): Promise<PrintResult> {
    return this.print(buildTicket(order, business));
  }

  async printReceiptText(text: string, logoBase64?: string): Promise<PrintResult> {
    return this.printPayload({ text, html: buildHtmlFromText(text, logoDataUri(logoBase64)), logoUri: logoDataUri(logoBase64) });
  }

  async printTest(): Promise<PrintResult> {
    const businessName = this.config.name ?? 'Mi Negocio';
    const text = buildTestPrintText(businessName);
    return this.printPayload({ text, html: buildHtmlFromText(text), logoUri: null });
  }
}

export function createInactivePrinterService(): PrinterService {
  return {
    available: false,
    label: 'Impresión aún no disponible',
    async print() {
      return { ok: false, message: 'Impresión aún no disponible.' };
    },
  };
}

export const printerService: PrinterController = new PrinterController();