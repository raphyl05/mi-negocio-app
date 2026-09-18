import type { CartItem } from '../utils/cart';

export type OrderStatus = 'pending' | 'paid';

export type PaymentMethod = 'cash' | 'transfer';

export type CustomerData = {
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
  createdAt: string;
  paidAt?: string;
};