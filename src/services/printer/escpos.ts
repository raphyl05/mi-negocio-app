// Comandos ESC/POS para impresoras térmicas de 58 mm (compatibles con Epson/ESC-POS).
// El servicio usa estos bytes con el transporte Bluetooth cuando una impresora real
// esté conectada (ver transports/bluetoothTransport.ts).

export const ESC = 0x1b;
export const GS = 0x1d;
export const LF = 0x0a;
export const CUT = 0x56;

export function initPrinter(): Uint8Array {
  return new Uint8Array([ESC, 0x40]);
}

export function feedLines(count: number): Uint8Array {
  return new Uint8Array([ESC, 0x64, count]);
}

export function cutPaper(mode = 0): Uint8Array {
  return new Uint8Array([GS, CUT, mode]);
}

function textToBytes(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const code = text.codePointAt(i) ?? 0;
    if (code > 0xffff) i += 1;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// Convierte el texto plano del ticket en una secuencia ESC/POS lista para enviar.
export function buildEscposBytes(text: string): Uint8Array {
  const withTrailingNewline = text.endsWith('\n') ? text : `${text}\n`;
  return concat([initPrinter(), textToBytes(withTrailingNewline), feedLines(3), cutPaper()]);
}

// Texto de prueba para verificar que una impresora imprime correctamente.
export const TEST_PRINTER_LINE = 'Impresora de prueba v1';

export function buildTestPrintText(businessName = 'Mi Negocio'): string {
  const divider = '-'.repeat(32);
  return [
    businessName.toUpperCase(),
    divider,
    'Prueba de impresion',
    'Si lees esto, todo funciona.',
    formatStamp(new Date()),
    divider,
    'Vendelo App',
    '',
  ].join('\n');
}

export function formatStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}