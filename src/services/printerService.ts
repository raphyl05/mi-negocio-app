import type { Order } from '../models/order';

export type PaymentMethod = Order['paymentMethod'];

export type PrintTicketLine = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type PrintTicket = {
  businessName: string;
  orderNumber: number;
  createdAt: string;
  customerName: string;
  lines: PrintTicketLine[];
  subtotalCents: number;
  paymentMethod: PaymentMethod;
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

export function buildTicket(order: Order, businessName: string): PrintTicket {
  return {
    businessName,
    orderNumber: order.number,
    createdAt: order.paidAt ?? order.createdAt,
    customerName: order.customer.customerName,
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