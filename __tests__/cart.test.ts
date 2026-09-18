import { addProductToCart, cartCount, cartSubtotal } from '../src/utils/cart';
import type { CartItem } from '../src/utils/cart';
import type { Product } from '../src/models/product';

const burger: Product = {
  id: 'p1',
  name: 'Hamburguesa',
  priceCents: 25000,
  category: 'Comidas',
  emoji: '🍔',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const soda: Product = {
  id: 'p2',
  name: 'Refresco',
  priceCents: 10000,
  category: 'Bebidas',
  emoji: '🥤',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('carrito', () => {
  it('agrega un producto nuevo con cantidad 1', () => {
    const result = addProductToCart([], burger);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(1);
  });

  it('incrementa la cantidad si el producto ya está', () => {
    const items = addProductToCart([{ product: burger, quantity: 2 }], burger);
    expect(items[0].quantity).toBe(3);
  });

  it('calcula el subtotal en centavos', () => {
    const items: CartItem[] = [
      { product: burger, quantity: 2 },
      { product: soda, quantity: 3 },
    ];
    expect(cartSubtotal(items)).toBe(80000);
  });

  it('cuenta las unidades totales', () => {
    const items: CartItem[] = [
      { product: burger, quantity: 2 },
      { product: soda, quantity: 1 },
    ];
    expect(cartCount(items)).toBe(3);
  });

  it('carrito vacío tiene subtotal y conteo en cero', () => {
    expect(cartSubtotal([])).toBe(0);
    expect(cartCount([])).toBe(0);
  });
});