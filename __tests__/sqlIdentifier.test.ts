import { isValidSqlIdentifier } from '../src/repositories/sqlIdentifier';

describe('isValidSqlIdentifier', () => {
  it('acepta identificadores SQL válidos', () => {
    expect(isValidSqlIdentifier('products')).toBe(true);
    expect(isValidSqlIdentifier('order_meta')).toBe(true);
    expect(isValidSqlIdentifier('_id')).toBe(true);
    expect(isValidSqlIdentifier('Orders2')).toBe(true);
  });

  it('rechaza inyección y nombres malformados', () => {
    expect(isValidSqlIdentifier('orders; DROP TABLE products')).toBe(false);
    expect(isValidSqlIdentifier('products x')).toBe(false);
    expect(isValidSqlIdentifier('prod"ucts')).toBe(false);
    expect(isValidSqlIdentifier('3productos')).toBe(false);
    expect(isValidSqlIdentifier('')).toBe(false);
    expect(isValidSqlIdentifier('products-table')).toBe(false);
  });
});