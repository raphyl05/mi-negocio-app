import { buildTicket, printerService } from '../services/printerService';
import type { Order } from '../models/order';
import type { Business } from '../models/business';

export function usePrinter() {
  return {
    available: printerService.available,
    statusLabel: printerService.label,
    printOrder: (order: Order, business: Business) => printerService.print(buildTicket(order, business)),
  };
}