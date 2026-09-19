import { invoiceCodeFor } from '../src/utils/invoice';

describe('invoiceCodeFor', () => {
  it('forma FAC-LLLL con al menos 4 dígitos', () => {
    expect(invoiceCodeFor(1)).toBe('FAC-0001');
    expect(invoiceCodeFor(4)).toBe('FAC-0004');
    expect(invoiceCodeFor(7)).toBe('FAC-0007');
    expect(invoiceCodeFor(123)).toBe('FAC-0123');
    expect(invoiceCodeFor(9999)).toBe('FAC-9999');
  });

  it('no corta códigos por encima de 9999', () => {
    expect(invoiceCodeFor(12345)).toBe('FAC-12345');
  });

  it('es único para números distintos', () => {
    expect(invoiceCodeFor(1)).not.toBe(invoiceCodeFor(2));
  });
});