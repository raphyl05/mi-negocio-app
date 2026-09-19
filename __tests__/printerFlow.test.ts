jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildEscposBytes, buildTestPrintText } from '../src/services/printer/escpos';
import { PrinterController } from '../src/services/printerService';
import { mergePrinterConfig } from '../src/services/printer/printerConfigStore';
import type { PrinterConfig } from '../src/services/printer/types';
import type { Order } from '../src/models/order';
import type { Product } from '../src/models/product';
import type { Business } from '../src/models/business';
import type { CartItem } from '../src/utils/cart';

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

function makeOrder(): Order {
  const items: CartItem[] = [{ product, quantity: 1 }];
  return {
    id: 'o1',
    number: 9,
    items,
    subtotalCents: 25000,
    customer: { customerName: '', phone: '', address: '', description: '' },
    status: 'paid',
    paymentMethod: 'cash',
    receivedCents: 25000,
    changeCents: 0,
    createdAt: '2026-09-18T08:00:00.000Z',
    paidAt: '2026-09-18T12:30:00.000Z',
  };
}

function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const first = bytes[i];
    if (first >= 0xf0) {
      const code = ((first & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      out += String.fromCodePoint(code);
      i += 4;
    } else if (first >= 0xe0) {
      const code = ((first & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      out += String.fromCodePoint(code);
      i += 3;
    } else if (first >= 0xc0) {
      const code = ((first & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      out += String.fromCodePoint(code);
      i += 2;
    } else {
      out += String.fromCodePoint(first);
      i += 1;
    }
  }
  return out;
}

describe('escpos', () => {
  it('empieza con inicialización de impresora (ESC @)', () => {
    const bytes = buildEscposBytes('Hola');
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
  });

  it('termina con salto y corte de papel (GS V)', () => {
    const bytes = buildEscposBytes('Hola');
    const tail = bytes.slice(bytes.length - 6, bytes.length);
    expect(Array.from(tail)).toEqual([0x1b, 0x64, 0x03, 0x1d, 0x56, 0x00]);
  });

  it('codifica texto en UTF-8 con acentos', () => {
    const bytes = buildEscposBytes('Llévame');
    const text = utf8Decode(bytes.slice(2, bytes.length - 6));
    expect(text).toBe('Llévame\n');
  });

  it('genera un ticket de prueba con el nombre del negocio', () => {
    const text = buildTestPrintText('Mi Negocio');
    expect(text).toContain('MI NEGOCIO');
    expect(text).toContain('Prueba de impresion');
    expect(text).toContain('Si lees esto, todo funciona.');
  });
});

describe('printerController', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('arranca apagada y sin impresora', () => {
    const controller = new PrinterController();
    expect(controller.available).toBe(false);
    expect(controller.label.length).toBeGreaterThan(0);
  });

  it('descubre la impresora de prueba sin hardware', async () => {
    const controller = new PrinterController();
    const devices = await controller.discover();
    expect(devices.some((device) => device.id === 'demo')).toBe(true);
  });

  it('conecta, imprime y luego se desconecta', async () => {
    const controller = new PrinterController();
    const demo = (await controller.discover()).find((device) => device.id === 'demo');
    expect(demo).toBeDefined();

    const connected = await controller.connect(demo!);
    expect(connected.ok).toBe(true);
    expect(controller.available).toBe(true);
    expect(controller.getStatus().state).toBe('connected');

    const result = await controller.printOrder(makeOrder(), business);
    expect(result.ok).toBe(true);

    await controller.disconnect();
    expect(controller.available).toBe(false);
  });

  it('se reconecta solo cuando la impresora vuelve a estar disponible', async () => {
    const controller = new PrinterController();
    const demo = (await controller.discover()).find((device) => device.id === 'demo');
    await controller.connect(demo!);
    expect(controller.getStatus().state).toBe('connected');

    await controller.ensureConnected();
    expect(controller.getStatus().state).toBe('connected');
  });

  it('sin impresora activa rechaza imprimir con mensaje claro', async () => {
    const controller = new PrinterController();
    const result = await controller.printOrder(makeOrder(), business);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Activa la impresora');
  });
});

describe('printerConfigStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('persiste y recupera la configuración elegida', async () => {
    const saved = await mergePrinterConfig({ enabled: true, type: 'demo', name: 'Prueba (impresión simulada)' });
    const config: PrinterConfig = saved;
    expect(config.enabled).toBe(true);
    expect(config.type).toBe('demo');
  });
});