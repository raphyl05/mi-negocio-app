import { calcChange, calcSubtotal } from './money';
import type { Order, OrderStatus, PaymentMethod, OrderType, OrderEvent } from '../models/order';
import type { CartItem } from './cart';
import { generateId } from './password';

export type BuildOrderInput = {
  items: CartItem[];
  customer: Order['customer'];
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  receivedCents?: number;
  orderType?: OrderType;
  waiterId?: string;
  waiterName?: string;
  tableId?: string;
  tableName?: string;
  prepStatus?: Order['prepStatus'];
  events?: OrderEvent[];
};

export function buildOrder(input: BuildOrderInput): Order {
  const subtotalCents = calcSubtotal(
    input.items.map((item) => ({ unitPriceCents: item.product.priceCents, quantity: item.quantity })),
  );

  const changeCents =
    input.paymentMethod === 'cash' && input.receivedCents !== undefined
      ? calcChange(subtotalCents, input.receivedCents)
      : undefined;

  const now = new Date().toISOString();
  const events: OrderEvent[] = input.events ?? [];
  if (input.prepStatus && input.prepStatus !== 'new') {
    events.push({ type: 'prepStatusChanged', prepStatus: input.prepStatus, at: now });
  }

  return {
    id: generateId(),
    number: 0,
    items: input.items,
    subtotalCents,
    customer: input.customer,
    status: input.status,
    paymentMethod: input.paymentMethod,
    receivedCents: input.receivedCents,
    changeCents,
    orderType: input.orderType ?? 'counter',
    waiterId: input.waiterId,
    waiterName: input.waiterName,
    tableId: input.tableId,
    tableName: input.tableName,
    prepStatus: input.prepStatus,
    events,
    createdAt: now,
    updatedAt: now,
    paidAt: input.status === 'paid' ? now : undefined,
  };
}