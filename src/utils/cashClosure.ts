import type { Order } from '../models/order';
import type { Business } from '../models/business';
import { calcDifference, formatMoney } from './money';
import { formatDate, formatTime } from './datetime';

export type CashTotals = {
  orderCount: number;
  salesCents: number;
  cashSalesCents: number;
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
  let transferSalesCents = 0;
  let orderCount = 0;

  for (const order of orders) {
    if (order.status !== 'paid') continue;
    salesCents += order.subtotalCents;
    orderCount += 1;
    if (order.paymentMethod === 'cash') {
      cashSalesCents += order.subtotalCents;
    } else {
      transferSalesCents += order.subtotalCents;
    }
  }

  return { orderCount, salesCents, cashSalesCents, transferSalesCents };
}

export function calcCashClosure(input: CashClosureInput): CashClosure {
  const totals = computeCashTotals(input.orders);
  const expectedCashCents = input.openingAmountCents + totals.cashSalesCents;
  return {
    ...totals,
    openingAmountCents: input.openingAmountCents,
    countedCashCents: input.countedCashCents,
    expectedCashCents,
    differenceCents: calcDifference(expectedCashCents, input.countedCashCents),
  };
}

export function renderClosureReceiptText(business: Business, closure: CashClosure, closedAtIso: string): string {
  const divider = '-'.repeat(42);
  const money = (cents: number) => formatMoney(cents);

  const lines: string[] = [];
  lines.push(business.name.toUpperCase());
  if (business.phone) {
    lines.push(`Tel: ${business.phone}`);
  }
  if (business.address) {
    lines.push(business.address);
  }
  lines.push(divider);
  lines.push('CIERRE DE CAJA');
  lines.push(`${formatDate(closedAtIso)}  ${formatTime(closedAtIso)}`);
  lines.push(divider);
  lines.push(`Ventas del turno (${closure.orderCount})`.padEnd(26) + money(closure.salesCents));
  if (closure.cashSalesCents > 0) {
    lines.push('En efectivo'.padEnd(26) + money(closure.cashSalesCents));
  }
  if (closure.transferSalesCents > 0) {
    lines.push('Por transferencia'.padEnd(26) + money(closure.transferSalesCents));
  }
  lines.push('Efectivo inicial'.padEnd(26) + money(closure.openingAmountCents));
  lines.push(divider);
  lines.push('Efectivo esperado'.padEnd(26) + money(closure.expectedCashCents));
  lines.push('Efectivo contado'.padEnd(26) + money(closure.countedCashCents));
  const differenceLabel =
    closure.differenceCents === 0
      ? money(0)
      : `${money(Math.abs(closure.differenceCents))} ${closure.differenceCents > 0 ? '(falta)' : '(sobra)'}`;
  lines.push('Diferencia'.padEnd(26) + differenceLabel);
  lines.push(divider);
  lines.push('');
  lines.push('¡Gracias por su trabajo!');
  return lines.join('\n');
}