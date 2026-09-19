import { useEffect, useState } from 'react';
import { buildTicket, printerService } from '../services/printerService';
import type { Order } from '../models/order';
import type { Business } from '../models/business';
import type { PrintTicket } from '../services/printerService';

export function usePrinter() {
  const [status, setStatus] = useState(() => printerService.getStatus());

  useEffect(() => printerService.subscribe(() => setStatus(printerService.getStatus())), []);

  return {
    status,
    available: status.ready,
    statusLabel: status.label,
    printOrder: (order: Order, business: Business) => printerService.printOrder(order, business),
    printReceiptText: (text: string, logoBase64?: string) => printerService.printReceiptText(text, logoBase64),
    printTest: () => printerService.printTest(),
    printTicket: (ticket: PrintTicket) => printerService.print(ticket),
  };
}