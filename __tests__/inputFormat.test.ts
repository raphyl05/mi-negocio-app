import {
  formatPhoneBlur,
  unformatPhoneFocus,
  sanitizeMoneyInput,
  sanitizeIntegerInput,
  sanitizePhoneInput,
} from '../src/utils/inputFormat';

describe('formatPhoneBlur', () => {
  it('formatea 10 dígitos como 809-000-0000', () => {
    expect(formatPhoneBlur('8095559666')).toBe('809-555-9666');
    expect(formatPhoneBlur('809 555 9666')).toBe('809-555-9666');
    expect(formatPhoneBlur('(809) 555-9666')).toBe('809-555-9666');
  });

  it('con más de 10 dígitos toma solo los primeros 10', () => {
    expect(formatPhoneBlur('8095559666123')).toBe('809-555-9666');
  });

  it('deja intactos los textos con menos de 10 dígitos', () => {
    expect(formatPhoneBlur('809')).toBe('809');
    expect(formatPhoneBlur('809555')).toBe('809555');
    expect(formatPhoneBlur('')).toBe('');
  });
});

describe('unformatPhoneFocus', () => {
  it('quita los guiones al volver a editar', () => {
    expect(unformatPhoneFocus('809-555-9666')).toBe('8095559666');
  });

  it('no altera un texto sin los 10 dígitos completos', () => {
    expect(unformatPhoneFocus('809')).toBe('809');
    expect(unformatPhoneFocus('')).toBe('');
  });
});

describe('sanitizadores de campos numéricos', () => {
  it('money quita letras y símbolos, conserva dígitos, punto y coma', () => {
    expect(sanitizeMoneyInput('abc1500xyz')).toBe('1500');
    expect(sanitizeMoneyInput('RD$1,500.00Q2')).toBe('1,500.002');
    expect(sanitizeMoneyInput('250.50!')).toBe('250.50');
    expect(sanitizeMoneyInput('')).toBe('');
  });

  it('integer deja solo dígitos', () => {
    expect(sanitizeIntegerInput('20abc35')).toBe('2035');
    expect(sanitizeIntegerInput('-10')).toBe('10');
    expect(sanitizeIntegerInput('stock=5')).toBe('5');
  });

  it('phone conserva dígitos y separadores de teléfono', () => {
    expect(sanitizePhoneInput('809-555-9666Á')).toBe('809-555-9666');
    expect(sanitizePhoneInput('(809) 555 9666x')).toBe('(809) 555 9666');
  });
});