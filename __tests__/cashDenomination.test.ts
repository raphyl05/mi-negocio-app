import {
  ALL_DENOMINATIONS,
  BILL_DENOMINATIONS,
  COIN_DENOMINATIONS,
  countTotalCents,
  hasAnyCount,
  sanitizeDenominationInput,
} from '../src/utils/cashDenomination';

describe('cashDenomination', () => {
  test('incluye las denominaciones de billetes y monedas RD$', () => {
    expect(BILL_DENOMINATIONS).toEqual([2000, 1000, 500, 200, 100]);
    expect(COIN_DENOMINATIONS).toEqual([50, 25, 10, 5, 1]);
    expect(ALL_DENOMINATIONS).toHaveLength(10);
  });

  test('conteo vacío suma 0', () => {
    expect(countTotalCents({})).toBe(0);
    expect(
      countTotalCents({
        '2000': '',
        '100': '0',
      }),
    ).toBe(0);
  });

  test('una sola denominación', () => {
    expect(countTotalCents({ '1000': '1' })).toBe(100000);
    expect(countTotalCents({ '25': '4' })).toBe(10000);
  });

  test('combinación de billetes y monedas', () => {
    const counts = { '2000': '2', '100': '3', '50': '1', '10': '2' };
    expect(countTotalCents(counts)).toBe((4000 + 300 + 50 + 20) * 100);
  });

  test('cantidades no numéricas o inválidas se ignoran', () => {
    expect(countTotalCents({ '500': 'abc', '100': '-2', '200': '3' })).toBe(60000);
  });

  test('hasAnyCount detecta si hay al menos un conteo', () => {
    expect(hasAnyCount({})).toBe(false);
    expect(hasAnyCount({ '2000': '' })).toBe(false);
    expect(hasAnyCount({ '10': '1' })).toBe(true);
  });

  test('sanitize permite solo dígitos y limita la longitud', () => {
    expect(sanitizeDenominationInput('1a2b3')).toBe('123');
    expect(sanitizeDenominationInput('9999999')).toBe('999999');
    expect(sanitizeDenominationInput('')).toBe('');
  });
});