import type { Order, PaymentMethod } from '../models/order';
import type { Business } from '../models/business';
import { formatDate, formatTime } from '../utils/datetime';
import { invoiceCodeFor } from '../utils/invoice';
import { formatMoney } from '../utils/money';

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

export type PrintResult = {
  ok: boolean;
  message: string;
};

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
  lines.push(ticket.status === 'paid' ? `Factura ${invoiceCodeFor(ticket.orderNumber)}` : `Ticket Nº ${ticket.orderNumber}`);
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

export function createInactivePrinterService(): PrinterService {
  return {
    available: false,
    label: 'Impresión aún no disponible',
    async print() {
      return { ok: false, message: 'Impresión aún no disponible.' };
    },
  };
}

export const printerService: PrinterService = createInactivePrinterService();