import type { Order } from '../src/models/order';
import type { Product } from '../src/models/product';
import type { Business } from '../src/models/business';
import type { CartItem } from '../src/utils/cart';
import {
  calcCashClosure,
  computeCashTotals,
  isOrderInRegister,
  renderClosureReceiptText,
} from '../src/utils/cashClosure';

const burger: Product = {
  id: 'p1',
  name: 'Hamburguesa',
  priceCents: 25000,
  category: 'Comidas',
  imageType: 'emoji',
  emoji: '🍔',
  stockQuantity: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const business: Business = {
  name: 'Mi Negocio',
  phone: '809-222-3344',
  address: 'Calle 1, Santiago',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const emptyCustomer = { customerName: '', phone: '', address: '', description: '' };

function makePaid(cents: number, method: 'cash' | 'transfer', received?: number, change = 0, paidAt = '2026-09-18T12:00:00.000Z'): Order {
  const items: CartItem[] = [{ product: burger, quantity: 1 }];
  return {
    id: method + cents,
    number: 1,
    items,
    subtotalCents: cents,
    customer: emptyCustomer,
    status: 'paid',
    paymentMethod: method,
    receivedCents: received,
    changeCents: method === 'cash' ? change : undefined,
    orderType: 'counter',
    events: [],
    createdAt: '2026-09-18T08:00:00.000Z',
    paidAt,
  };
}

const OPENED_AT = '2026-09-18T09:00:00.000Z';

describe('isOrderInRegister', () => {
  it('incluye orden pagada después de abrir la caja', () => {
    expect(isOrderInRegister(makePaid(1000, 'cash'), OPENED_AT)).toBe(true);
  });

  it('excluye órdenes pendientes', () => {
    const pending: Order = { ...makePaid(1000, 'cash'), status: 'pending', paidAt: undefined };
    expect(isOrderInRegister(pending, OPENED_AT)).toBe(false);
  });

  it('excluye ventas pagadas antes de abrir la caja', () => {
    const order = makePaid(1000, 'cash', undefined, 0, '2026-09-18T08:30:00.000Z');
    expect(isOrderInRegister(order, OPENED_AT)).toBe(false);
  });

  it('excluye una venta anulada aunque fuera pagada dentro del turno', () => {
    const voided: Order = {
      ...makePaid(60000, 'cash', 60000),
      status: 'voided',
      voidedAt: '2026-09-18T12:00:00.000Z',
    };
    expect(isOrderInRegister(voided, OPENED_AT)).toBe(false);
  });
});

describe('computeCashTotals', () => {
  it('separa efectivo y transferencia sin contar el cambio devuelto', () => {
    const orders = [
      makePaid(60000, 'cash', 100000, 40000),
      makePaid(25000, 'transfer'),
      makePaid(25000, 'cash', 25000, 0),
    ];
    const totals = computeCashTotals(orders);
    expect(totals.orderCount).toBe(3);
    expect(totals.salesCents).toBe(110000);
    expect(totals.cashSalesCents).toBe(85000);
    expect(totals.transferSalesCents).toBe(25000);
  });

  it('ignora órdenes pendientes', () => {
    const pending: Order = { ...makePaid(60000, 'cash', 60000), status: 'pending', paidAt: undefined };
    expect(computeCashTotals([pending]).salesCents).toBe(0);
    expect(computeCashTotals([pending]).orderCount).toBe(0);
  });

  it('ignora una venta anulada dentro del turno', () => {
    const voided: Order = {
      ...makePaid(60000, 'cash', 60000),
      status: 'voided',
      voidedAt: '2026-09-18T12:00:00.000Z',
    };
    expect(computeCashTotals([voided])).toEqual({
      orderCount: 0,
      salesCents: 0,
      cashSalesCents: 0,
      transferSalesCents: 0,
    });
  });

  it('devuelve ceros con lista vacía', () => {
    const totals = computeCashTotals([]);
    expect(totals).toEqual({
      orderCount: 0,
      salesCents: 0,
      cashSalesCents: 0,
      transferSalesCents: 0,
    });
  });
});

describe('calcCashClosure', () => {
  it('efectivo esperado = inicial + ventas en efectivo', () => {
    const orders = [
      makePaid(60000, 'cash', 100000),
      makePaid(25000, 'transfer'),
    ];
    const closure = calcCashClosure({
      openingAmountCents: 50000,
      countedCashCents: 110000,
      orders,
    });
    expect(closure.expectedCashCents).toBe(110000);
    expect(closure.differenceCents).toBe(0);
  });

  it('sin ventas, lo esperado es solo el efectivo inicial', () => {
    const closure = calcCashClosure({ openingAmountCents: 100000, countedCashCents: 100000, orders: [] });
    expect(closure.expectedCashCents).toBe(100000);
    expect(closure.differenceCents).toBe(0);
  });

  it('diferencia positiva cuando falta dinero', () => {
    const closure = calcCashClosure({
      openingAmountCents: 50000,
      countedCashCents: 65000,
      orders: [makePaid(60000, 'cash', 100000)],
    });
    expect(closure.expectedCashCents).toBe(110000);
    expect(closure.differenceCents).toBe(45000);
  });

  it('diferencia negativa cuando sobra dinero', () => {
    const closure = calcCashClosure({
      openingAmountCents: 50000,
      countedCashCents: 115000,
      orders: [makePaid(60000, 'cash', 100000)],
    });
    expect(closure.expectedCashCents).toBe(110000);
    expect(closure.differenceCents).toBe(-5000);
  });
});

describe('renderClosureReceiptText', () => {
  it('prepara el recibo con el negocio y el resumen', () => {
    const closure = calcCashClosure({
      openingAmountCents: 50000,
      countedCashCents: 65000,
      orders: [
        makePaid(60000, 'cash', 100000),
        makePaid(25000, 'transfer', undefined, 0, '2026-09-18T11:00:00.000Z'),
      ],
    });
    const text = renderClosureReceiptText(business, closure, '2026-09-18T18:00:00.000Z');
    expect(text).toContain('MI NEGOCIO');
    expect(text).toContain('Tel: 809-222-3344');
    expect(text).toContain('CIERRE DE CAJA');
    expect(text).toContain('18/09/2026');
    expect(text).toContain('RD$850.00');
    expect(text).toContain('RD$600.00');
    expect(text).toContain('RD$250.00');
    expect(text).toContain('RD$1,100.00');
    expect(text).toContain('(falta)');
    expect(text).toContain('¡Gracias por su trabajo!');
  });
});