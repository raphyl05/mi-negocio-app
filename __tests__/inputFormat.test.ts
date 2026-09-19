import { formatPhoneBlur, unformatPhoneFocus } from '../src/utils/inputFormat';

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