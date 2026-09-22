import type { Order } from '../models/order';

export type KitchenTicket = {
  id: string;
  orderId: string;
  orderNumber: number;
  prepStatus: Order['prepStatus'];
  waiterName?: string;
  tableName?: string;
  customerName?: string;
  subtotalCents: number;
  itemCount: number;
  createdAt: string;
};
