import type { Order } from '../models/order';
import { calcDifference } from './money';

export type CashTotals = {
  orderCount: number;
  salesCents: number;
  cashSalesCents: number;
  cashChangeCents: number;
  transferSalesCents: number;
};

export type CashClosure = CashTotals & {
  openingAmountCents: number;
  countedCashCents: number;
  expectedCashCents: number;
  differenceCents: number;
};

export type CashClosureInput = {
  openingAmountCents: number;
  countedCashCents: number;
  orders: Order[];
};

export function isOrderInRegister(order: Order, openedAtIso: string): boolean {
  if (order.status !== 'paid') return false;
  return (order.paidAt ?? order.createdAt) >= openedAtIso;
}

export function computeCashTotals(orders: Order[]): CashTotals {
  let salesCents = 0;
  let cashSalesCents = 0;
  let cashChangeCents = 0;
  let transferSalesCents = 0;
  let orderCount = 0;

  for (const order of orders) {
    if (order.status !== 'paid') continue;
    salesCents += order.subtotalCents;
    orderCount += 1;
    if (order.paymentMethod === 'cash') {
      cashSalesCents += order.subtotalCents;
      cashChangeCents += order.changeCents ?? 0;
    } else {
      transferSalesCents += order.subtotalCents;
    }
  }

  return { orderCount, salesCents, cashSalesCents, cashChangeCents, transferSalesCents };
}

export function calcCashClosure(input: CashClosureInput): CashClosure {
  const totals = computeCashTotals(input.orders);
  const expectedCashCents = input.openingAmountCents + totals.cashSalesCents - totals.cashChangeCents;
  return {
    ...totals,
    openingAmountCents: input.openingAmountCents,
    countedCashCents: input.countedCashCents,
    expectedCashCents,
    differenceCents: calcDifference(expectedCashCents, input.countedCashCents),
  };
}