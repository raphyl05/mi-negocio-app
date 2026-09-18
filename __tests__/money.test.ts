import { formatMoney, calcSubtotal, calcChange, calcDifference } from '../src/utils/money';

describe('formatMoney', () => {
  it('formatea pesos dominicanos con dos decimales', () => {
    expect(formatMoney(25000)).toBe('RD$250.00');
    expect(formatMoney(0)).toBe('RD$0.00');
    expect(formatMoney(65050)).toBe('RD$650.50');
    expect(formatMoney(1)).toBe('RD$0.01');
  });

  it('agrega separador de miles', () => {
    expect(formatMoney(150000)).toBe('RD$1,500.00');
    expect(formatMoney(485000)).toBe('RD$4,850.00');
    expect(formatMoney(123456789)).toBe('RD$1,234,567.89');
  });

  it('formatea montos negativos', () => {
    expect(formatMoney(-5000)).toBe('-RD$50.00');
  });

  it('permite ocultar decimales', () => {
    expect(formatMoney(150000, { decimals: false })).toBe('RD$1,500');
    expect(formatMoney(25000, { decimals: false })).toBe('RD$250');
  });
});

describe('calcSubtotal', () => {
  it('suma cantidades por precio unitario', () => {
    const items = [
      { unitPriceCents: 25000, quantity: 2 },
      { unitPriceCents: 10000, quantity: 1 },
      { unitPriceCents: 5000, quantity: 1 },
    ];
    expect(calcSubtotal(items)).toBe(65000);
  });

  it('devuelve cero con lista vacía', () => {
    expect(calcSubtotal([])).toBe(0);
  });
});

describe('calcChange', () => {
  it('calcula el cambio correctamente', () => {
    expect(calcChange(65000, 100000)).toBe(35000);
    expect(calcChange(65000, 65000)).toBe(0);
  });

  it('devuelve negativo si el efectivo recibido es menor', () => {
    expect(calcChange(65000, 50000)).toBe(-15000);
  });
});

describe('calcDifference', () => {
  it('calcula la diferencia de caja esperado vs contado', () => {
    expect(calcDifference(475000, 470000)).toBe(5000);
    expect(calcDifference(475000, 475000)).toBe(0);
    expect(calcDifference(475000, 480000)).toBe(-5000);
  });
});