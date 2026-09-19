import {
  validateAnswer,
  validateNewPassword,
  validateSecurityQuestion,
} from '../src/utils/securityValidation';

describe('validateSecurityQuestion', () => {
  it('rechaza pregunta vacía', () => {
    expect(validateSecurityQuestion('')).not.toBeNull();
    expect(validateSecurityQuestion('   ')).not.toBeNull();
  });

  it('rechaza pregunta demasiado corta', () => {
    expect(validateSecurityQuestion('¿Y?')).not.toBeNull();
  });

  it('acepta una pregunta razonable', () => {
    expect(validateSecurityQuestion('¿Cuál es el nombre de mi primera mascota?')).toBeNull();
  });
});

describe('validateAnswer', () => {
  it('rechaza respuesta vacía', () => {
    expect(validateAnswer('  ')).not.toBeNull();
  });

  it('rechaza respuesta demasiado corta', () => {
    expect(validateAnswer('a')).not.toBeNull();
  });

  it('acepta una respuesta válida', () => {
    expect(validateAnswer('luna')).toBeNull();
  });
});

describe('validateNewPassword', () => {
  const valid = { newPassword: 'clave1234', confirmPassword: 'clave1234' };

  it('acepta contraseñas que coinciden y son largas', () => {
    expect(validateNewPassword(valid.newPassword, valid.confirmPassword)).toEqual({});
  });

  it('rechaza contraseña demasiado corta', () => {
    const errors = validateNewPassword('123', '123');
    expect(errors.newPassword).toBeDefined();
  });

  it('rechaza contraseñas que no coinciden', () => {
    const errors = validateNewPassword('clave1234', 'otra');
    expect(errors.confirmPassword).toBeDefined();
  });

  it('rechaza ambas cuando la contraseña es corta y no coincide', () => {
    const errors = validateNewPassword('ab', 'cd');
    expect(errors.newPassword).toBeDefined();
    expect(errors.confirmPassword).toBeDefined();
  });
});