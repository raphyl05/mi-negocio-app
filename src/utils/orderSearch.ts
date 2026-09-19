import type { Order } from '../models/order';
import { formatDate, formatTime } from './datetime';
import { invoiceCodeFor } from './invoice';

export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function orderMatchesQuery(order: Order, query: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;

  const { customer } = order;
  const haystack = [
    String(order.number),
    invoiceCodeFor(order.number),
    customer.customerName,
    customer.phone,
    customer.address,
    customer.description,
    ...order.items.map((item) => item.product.name),
    formatDate(order.createdAt),
    formatTime(order.createdAt),
  ].join(' ');

  return normalizeSearchText(haystack).includes(q);
}

export function filterOrders(orders: Order[], query: string): Order[] {
  return orders.filter((order) => orderMatchesQuery(order, query));
}