import type { Order } from '../src/models/order';
import type { Product } from '../src/models/product';
import type { CartItem } from '../src/utils/cart';
import { buildTicket, createInactivePrinterService, printerService } from '../src/services/printerService';

const product: Product = {
  id: 'p1',
  name: 'Hamburguesa',
  priceCents: 25000,
  category: 'Comidas',
  imageType: 'emoji',
  emoji: '🍔',
  trackStock: false,
  stockQuantity: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const emptyCustomer = { customerName: '', phone: '', address: '', description: '' };

function makeOrder(overrides: Partial<Order> = {}): Order {
  const items: CartItem[] = [{ product, quantity: 2 }];
  return {
    id: 'o1',
    number: 7,
    items,
    subtotalCents: 50000,
    customer: { ...emptyCustomer, customerName: 'Cliente' },
    status: 'paid',
    paymentMethod: 'cash',
    receivedCents: 100000,
    changeCents: 50000,
    createdAt: '2026-09-18T08:00:00.000Z',
    paidAt: '2026-09-18T12:30:00.000Z',
    ...overrides,
  };
}

describe('buildTicket', () => {
  it('arma un ticket con el negocio y los datos de la orden', () => {
    const ticket = buildTicket(makeOrder(), 'Mi Negocio');
    expect(ticket.businessName).toBe('Mi Negocio');
    expect(ticket.orderNumber).toBe(7);
    expect(ticket.createdAt).toBe('2026-09-18T12:30:00.000Z');
    expect(ticket.customerName).toBe('Cliente');
    expect(ticket.subtotalCents).toBe(50000);
    expect(ticket.paymentMethod).toBe('cash');
    expect(ticket.receivedCents).toBe(100000);
    expect(ticket.changeCents).toBe(50000);
  });

  it('convierte cada línea del carrito en una línea de ticket', () => {
    const ticket = buildTicket(makeOrder(), 'Negocio');
    expect(ticket.lines).toEqual([
      { name: 'Hamburguesa', quantity: 2, unitPriceCents: 25000 },
    ]);
  });

  it('usa created_at como fecha si la orden no fue pagada', () => {
    const pending = makeOrder({
      status: 'pending',
      paidAt: undefined,
      paymentMethod: undefined,
      receivedCents: undefined,
      changeCents: undefined,
    });
    const ticket = buildTicket(pending, 'Negocio');
    expect(ticket.createdAt).toBe('2026-09-18T08:00:00.000Z');
    expect(ticket.paymentMethod).toBeUndefined();
  });

  it('soporta ticket de transferencia sin recibido ni cambio', () => {
    const order = makeOrder({ status: 'paid', paymentMethod: 'transfer', receivedCents: undefined, changeCents: undefined });
    const ticket = buildTicket(order, 'Negocio');
    expect(ticket.paymentMethod).toBe('transfer');
    expect(ticket.receivedCents).toBeUndefined();
    expect(ticket.changeCents).toBeUndefined();
  });
});

describe('PrinterService inactivo', () => {
  it('está deshabilitado y rechaza imprimir', async () => {
    const service = createInactivePrinterService();
    expect(service.available).toBe(false);
    const result = await service.print(buildTicket(makeOrder(), 'Negocio'));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('no disponible');
  });

  it('es el singleton que expone la app', () => {
    expect(printerService.available).toBe(false);
    expect(printerService.label.length).toBeGreaterThan(0);
  });
});