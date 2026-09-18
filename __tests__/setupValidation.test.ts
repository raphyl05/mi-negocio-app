import { validateSetup } from '../src/utils/setupValidation';

const valid = {
  name: 'Mi Negocio',
  username: 'vendedor',
  password: '1234',
  confirmPassword: '1234',
};

describe('validateSetup', () => {
  it('acepta un formulario válido', () => {
    expect(validateSetup(valid)).toEqual({});
  });

  it('rechaza negocio vacío', () => {
    const errors = validateSetup({ ...valid, name: '  ' });
    expect(errors.name).toBeDefined();
  });

  it('rechaza usuario vacío', () => {
    const errors = validateSetup({ ...valid, username: '' });
    expect(errors.username).toBeDefined();
  });

  it('rechaza contraseña vacía y corta', () => {
    expect(validateSetup({ ...valid, password: '' }).password).toBeDefined();
    expect(validateSetup({ ...valid, password: '12' }).password).toBeDefined();
  });

  it('rechaza confirmación vacía', () => {
    expect(validateSetup({ ...valid, confirmPassword: '' }).confirmPassword).toBeDefined();
  });

  it('rechaza contraseñas que no coinciden', () => {
    const errors = validateSetup({ ...valid, confirmPassword: 'otra' });
    expect(errors.confirmPassword).toBeDefined();
  });

  it('no valida la confirmación si la contraseña ya falló', () => {
    const errors = validateSetup({ ...valid, password: '', confirmPassword: '' });
    expect(errors.confirmPassword).toBeUndefined();
  });
});