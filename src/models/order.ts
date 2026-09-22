import type { CartItem } from '../utils/cart';

export type OrderStatus = 'pending' | 'paid' | 'voided';

export type PaymentMethod = 'cash' | 'transfer';

export type OrderType = 'counter' | 'waiter';

export type OrderPrepStatus = 'new' | 'sent' | 'preparing' | 'ready' | 'served';

export type OrderEvent = {
  type: string;
  prepStatus?: OrderPrepStatus;
  at?: string;
  method?: string;
};

export type CustomerData = {
  customerId?: string;
  customerName: string;
  phone: string;
  address: string;
  description: string;
};

export type Order = {
  id: string;
  number: number;
  items: CartItem[];
  subtotalCents: number;
  customer: CustomerData;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  receivedCents?: number;
  changeCents?: number;
  orderType?: OrderType;
  waiterId?: string;
  waiterName?: string;
  tableId?: string;
  tableName?: string;
  prepStatus?: OrderPrepStatus;
  events?: OrderEvent[];
  createdAt: string;
  updatedAt?: string;
  paidAt?: string;
  voidedAt?: string;
  voidReason?: string;
};