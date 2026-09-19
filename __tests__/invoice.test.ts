import { invoiceCodeFor, prefixValue, prefixLetters } from '../src/utils/invoice';

describe('invoiceCodeFor', () => {
  it('empieza en FAC-0001 y mantiene el formato de 4 dígitos', () => {
    expect(invoiceCodeFor(1)).toBe('FAC-0001');
    expect(invoiceCodeFor(4)).toBe('FAC-0004');
    expect(invoiceCodeFor(7)).toBe('FAC-0007');
    expect(invoiceCodeFor(123)).toBe('FAC-0123');
    expect(invoiceCodeFor(9998)).toBe('FAC-9998');
    expect(invoiceCodeFor(9999)).toBe('FAC-9999');
  });

  it('sigue variando las 3 letras después de FAC-9999 para no agotar códigos', () => {
    expect(invoiceCodeFor(10000)).toBe('FAD-0001');
    expect(invoiceCodeFor(19998)).toBe('FAD-9999');
    expect(invoiceCodeFor(19999)).toBe('FAE-0001');
    expect(invoiceCodeFor(20000)).toBe('FAE-0002');
    expect(invoiceCodeFor(239976)).toBe('FAZ-9999');
    expect(invoiceCodeFor(239977)).toBe('FBA-0001');
  });

  it('nunca emite FAC-0000 y siempre avanza el número', () => {
    for (let n = 1; n <= 15000; n += 1) {
      const code = invoiceCodeFor(n);
      expect(code).toMatch(/^[A-Z]{3}-\d{4}$/);
      expect(code.endsWith('-0000')).toBe(false);
    }
  });

  it('es único para órdenes distintas', () => {
    const seen = new Set<string>();
    for (let n = 1; n <= 40000; n += 1) {
      const code = invoiceCodeFor(n);
      expect(seen.has(code)).toBe(false);
      seen.add(code);
    }
  });
});

describe('helpers base-26', () => {
  it('convierte FAC de ida y vuelta', () => {
    const value = prefixValue('FAC');
    expect(prefixLetters(value)).toBe('FAC');
    expect(prefixLetters(value + 1)).toBe('FAD');
    expect(prefixLetters(value + 23)).toBe('FAZ');
    expect(prefixLetters(value + 24)).toBe('FBA');
  });
});