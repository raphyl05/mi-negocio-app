import { formatMoney, calcSubtotal, calcChange, calcDifference, parseMoney, formatMoneyBlur, unformatMoneyFocus } from '../src/utils/money';

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

describe('parseMoney', () => {
  it('convierte texto a centavos', () => {
    expect(parseMoney('500')).toBe(50000);
    expect(parseMoney('500.50')).toBe(50050);
    expect(parseMoney('500,50')).toBe(50050);
    expect(parseMoney('0')).toBe(0);
    expect(parseMoney(' 1500 ')).toBe(150000);
  });

  it('acepta hasta dos decimales', () => {
    expect(parseMoney('10.5')).toBe(1050);
  });

  it('rechaza entradas inválidas', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('-5')).toBeNull();
    expect(parseMoney('12.345')).toBeNull();
    expect(parseMoney('500 pesos')).toBeNull();
  });
});

describe('formatMoneyBlur', () => {
  it('se aplica al salir del campo: 500 -> RD$500.00', () => {
    expect(formatMoneyBlur('500')).toBe('RD$500.00');
    expect(formatMoneyBlur('500.50')).toBe('RD$500.50');
    expect(formatMoneyBlur('0')).toBe('RD$0.00');
  });

  it('agrupa montos grandes con separador de miles', () => {
    expect(formatMoneyBlur('1500')).toBe('RD$1,500.00');
    expect(formatMoneyBlur('4850.25')).toBe('RD$4,850.25');
  });

  it('deja intacto lo que no se puede interpretar', () => {
    expect(formatMoneyBlur('')).toBe('');
    expect(formatMoneyBlur('abc')).toBe('abc');
    expect(formatMoneyBlur('500 pesos')).toBe('500 pesos');
  });
});

describe('unformatMoneyFocus', () => {
  it('quita RD$, comas y espacios al enfocar un valor formateado', () => {
    expect(unformatMoneyFocus('RD$1,500.00')).toBe('1500.00');
    expect(unformatMoneyFocus('RD$500.00')).toBe('500.00');
  });

  it('no altera un texto que aún no fue formateado', () => {
    expect(unformatMoneyFocus('500')).toBe('500');
    expect(unformatMoneyFocus('')).toBe('');
  });
});