import { calcChange, calcSubtotal } from './money';
import type { Order, OrderStatus, PaymentMethod } from '../models/order';
import type { CartItem } from './cart';
import { generateId } from './password';

export type BuildOrderInput = {
  items: CartItem[];
  customer: Order['customer'];
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  receivedCents?: number;
};

export function buildOrder(input: BuildOrderInput): Order {
  const subtotalCents = calcSubtotal(
    input.items.map((item) => ({ unitPriceCents: item.product.priceCents, quantity: item.quantity })),
  );

  const changeCents =
    input.paymentMethod === 'cash' && input.receivedCents !== undefined
      ? calcChange(subtotalCents, input.receivedCents)
      : undefined;

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
    createdAt: new Date().toISOString(),
    paidAt: input.status === 'paid' ? new Date().toISOString() : undefined,
  };
}