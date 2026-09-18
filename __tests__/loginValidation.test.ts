import { validateLogin } from '../src/utils/loginValidation';

describe('validateLogin', () => {
  const valid = { username: 'vendedor', password: '1234' };

  it('acepta campos completos', () => {
    expect(validateLogin(valid)).toEqual({});
  });

  it('rechaza usuario vacío', () => {
    const errors = validateLogin({ ...valid, username: '  ' });
    expect(errors.username).toBeDefined();
  });

  it('rechaza contraseña vacía', () => {
    const errors = validateLogin({ ...valid, password: '' });
    expect(errors.password).toBeDefined();
  });
});