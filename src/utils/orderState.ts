import type { OrderStatus } from '../models/order';

export const ORDER_STATUSES: readonly OrderStatus[] = ['pending', 'paid', 'voided'];

export function assertOrderTransition(current: OrderStatus, next: OrderStatus): void {
  if (current === next) {
    if (current === 'pending') return;
    throw new Error('Una venta pagada o anulada no puede modificarse. Usa el flujo de anulación.');
  }
  if (next === 'pending') {
    throw new Error('Una venta no puede volver al estado pendiente.');
  }
  if (current === 'voided') {
    throw new Error('Una venta anulada no puede modificarse.');
  }
}