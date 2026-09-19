import type { Order } from '../src/models/order';
import type { Product } from '../src/models/product';
import type { Business } from '../src/models/business';
import type { CartItem } from '../src/utils/cart';
import {
  buildTicket,
  createInactivePrinterService,
  logoDataUri,
  printerService,
  renderTicketText,
} from '../src/services/printerService';

const business: Business = {
  name: 'Mi Negocio',
  phone: '809-555-1234',
  address: 'Av. Principal #12, Santo Domingo',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const product: Product = {
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
    const ticket = buildTicket(makeOrder(), business);
    expect(ticket.businessName).toBe('Mi Negocio');
    expect(ticket.businessPhone).toBe('809-555-1234');
    expect(ticket.businessAddress).toContain('Av. Principal');
    expect(ticket.orderNumber).toBe(7);
    expect(ticket.createdAt).toBe('2026-09-18T12:30:00.000Z');
    expect(ticket.status).toBe('paid');
    expect(ticket.customerName).toBe('Cliente');
    expect(ticket.subtotalCents).toBe(50000);
    expect(ticket.paymentMethod).toBe('cash');
    expect(ticket.receivedCents).toBe(100000);
    expect(ticket.changeCents).toBe(50000);
  });

  it('convierte cada línea del carrito en una línea de ticket', () => {
    const ticket = buildTicket(makeOrder(), business);
    expect(ticket.lines).toEqual([
      { name: 'Hamburguesa', quantity: 2, unitPriceCents: 25000 },
    ]);
  });

  it('marca el ticket como pendiente cuando la orden no fue pagada', () => {
    const pending = makeOrder({
      status: 'pending',
      paidAt: undefined,
      paymentMethod: undefined,
      receivedCents: undefined,
      changeCents: undefined,
    });
    const ticket = buildTicket(pending, business);
    expect(ticket.createdAt).toBe('2026-09-18T08:00:00.000Z');
    expect(ticket.status).toBe('pending');
    expect(ticket.paymentMethod).toBeUndefined();
  });

  it('incluye el logo base64 del negocio cuando existe', () => {
    const logoBusiness: Business = { ...business, logoBase64: 'aW1hZ2VuLTE=' };
    const ticket = buildTicket(makeOrder(), logoBusiness);
    expect(ticket.logoBase64).toBe('aW1hZ2VuLTE=');
    expect(logoDataUri('aW1hZ2VuLTE=')).toBe('data:image/png;base64,aW1hZ2VuLTE=');
    expect(logoDataUri(undefined)).toBeNull();
  });

  it('deja el ticket como pagada para órdenes cobradas', () => {
    const ticket = buildTicket(makeOrder(), business);
    expect(ticket.status).toBe('paid');
  });

  it('soporta ticket de transferencia sin recibido ni cambio', () => {
    const order = makeOrder({ status: 'paid', paymentMethod: 'transfer', receivedCents: undefined, changeCents: undefined });
    const ticket = buildTicket(order, business);
    expect(ticket.paymentMethod).toBe('transfer');
    expect(ticket.receivedCents).toBeUndefined();
    expect(ticket.changeCents).toBeUndefined();
  });
});

describe('renderTicketText', () => {
  it('prepara el formato de impresión de un ticket pagado', () => {
    const text = renderTicketText(buildTicket(makeOrder(), business));
    expect(text).toContain('MI NEGOCIO');
    expect(text).toContain('Tel: 809-555-1234');
    expect(text).toContain('Av. Principal');
    expect(text).toContain('Factura FAC-0007');
    expect(text).toContain('Hamburguesa');
    expect(text).toContain('2 x RD$250.00');
    expect(text).toContain('RD$500.00');
    expect(text).toContain('Metodo de pago: Efectivo');
    expect(text).not.toContain('PAGO PENDIENTE');
    expect(text).toContain('¡Gracias por su compra!');
  });

  it('imprime los datos del cliente solo cuando existen', () => {
    const fullCustomer = {
      customerName: 'Juan Pérez',
      phone: '809-555-9876',
      address: 'Calle 1 #23',
      description: 'Entregar por la puerta de atrás',
    };
    const text = renderTicketText(
      buildTicket(makeOrder({ customer: fullCustomer }), business),
    );
    expect(text).toContain('Cliente: Juan Pérez');
    expect(text).toContain('Tel: 809-555-9876');
    expect(text).toContain('Direccion: Calle 1 #23');
    expect(text).toContain('Nota: Entregar por la puerta de atrás');
  });

  it('omite los datos del cliente cuando todo está vacío', () => {
    const text = renderTicketText(buildTicket(makeOrder({ customer: emptyCustomer }), business));
    expect(text).not.toContain('Cliente:');
    expect(text).not.toContain('809-555-9876');
    expect(text).not.toContain('Direccion:');
    expect(text).not.toContain('Nota:');
  });

  it('resalta PAGO PENDIENTE en tickets no cobrados', () => {
    const pending = makeOrder({
      status: 'pending',
      paidAt: undefined,
      paymentMethod: undefined,
      receivedCents: undefined,
      changeCents: undefined,
    });
    const text = renderTicketText(buildTicket(pending, business));
    expect(text).toContain('*** PAGO PENDIENTE ***');
  });
});

describe('PrinterService inactivo', () => {
  it('está deshabilitado y rechaza imprimir', async () => {
    const service = createInactivePrinterService();
    expect(service.available).toBe(false);
    const result = await service.print(buildTicket(makeOrder(), business));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('no disponible');
  });

  it('es el singleton que expone la app', () => {
    expect(printerService.available).toBe(false);
    expect(printerService.label.length).toBeGreaterThan(0);
  });
});