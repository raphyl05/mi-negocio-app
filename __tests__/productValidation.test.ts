import { validateProduct } from '../src/utils/productValidation';

const base = { name: 'Hamburguesa', priceText: '250', category: 'Comidas', trackStock: false, stockText: '' };

describe('validateProduct', () => {
  it('acepta un producto válido', () => {
    expect(validateProduct(base)).toEqual({});
  });

  it('exige el nombre', () => {
    const errors = validateProduct({ ...base, name: '  ' });
    expect(errors.name).toBe('El nombre es obligatorio');
  });

  it('exige un precio mayor a 0', () => {
    expect(validateProduct({ ...base, priceText: '' }).price).toBeDefined();
    expect(validateProduct({ ...base, priceText: '0' }).price).toBeDefined();
    expect(validateProduct({ ...base, priceText: 'abc' }).price).toBeDefined();
    expect(validateProduct({ ...base, priceText: '-5' }).price).toBeDefined();
    expect(validateProduct({ ...base, priceText: '250.50' })).toEqual({});
  });

  it('exige la categoría', () => {
    const errors = validateProduct({ ...base, category: '' });
    expect(errors.category).toBe('La categoría es obligatoria');
  });

  it('valida el stock solo si se controla', () => {
    const valid = validateProduct({ ...base, trackStock: true, stockText: '12' });
    expect(valid).toEqual({});
    expect(validateProduct({ ...base, trackStock: true, stockText: '' }).stock).toBeDefined();
    expect(validateProduct({ ...base, trackStock: true, stockText: '1.5' }).stock).toBeDefined();
    expect(validateProduct({ ...base, trackStock: true, stockText: '-3' }).stock).toBeDefined();
    expect(validateProduct({ ...base, trackStock: true, stockText: 'abc' }).stock).toBeDefined();
  });
});