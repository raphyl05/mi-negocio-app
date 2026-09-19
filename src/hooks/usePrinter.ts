import { buildTicket, printerService } from '../services/printerService';
import type { Order } from '../models/order';

export function usePrinter() {
  return {
    available: printerService.available,
    statusLabel: printerService.label,
    printOrder: (order: Order, businessName: string) =>
      printerService.print(buildTicket(order, businessName)),
  };
}