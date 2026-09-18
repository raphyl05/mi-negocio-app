import {
  addProductToCart,
  cartCount,
  cartSubtotal,
  clearCart,
  decreaseItem,
  increaseItem,
  removeItem,
} from '../src/utils/cart';
import type { CartItem } from '../src/utils/cart';
import type { Product } from '../src/models/product';

const burger: Product = {
  id: 'p1',
  name: 'Hamburguesa',
  priceCents: 25000,
  category: 'Comidas',
  imageType: 'emoji',
  emoji: '🍔',
  trackStock: false,
  stockQuantity: 0,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const soda: Product = {
  id: 'p2',
  name: 'Refresco',
  priceCents: 10000,
  category: 'Bebidas',
  imageType: 'emoji',
emoji: '🥤',
  trackStock: false,
  stockQuantity: 0,
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

  it('incrementa una línea existente', () => {
    const items: CartItem[] = [{ product: burger, quantity: 1 }];
    const result = increaseItem(items, 'p1');
    expect(result[0].quantity).toBe(2);
  });

  it('decrementa y elimina la línea al llegar a cero', () => {
    const items: CartItem[] = [{ product: burger, quantity: 2 }];
    expect(decreaseItem(items, 'p1')[0].quantity).toBe(1);
    expect(decreaseItem([{ product: burger, quantity: 1 }], 'p1')).toHaveLength(0);
  });

  it('elimina una línea completa', () => {
    const items: CartItem[] = [
      { product: burger, quantity: 1 },
      { product: soda, quantity: 3 },
    ];
    const result = removeItem(items, 'p1');
    expect(result).toHaveLength(1);
    expect(result[0].product.id).toBe('p2');
  });

  it('limpia el carrito', () => {
    const items: CartItem[] = [{ product: burger, quantity: 1 }];
    expect(clearCart()).toHaveLength(0);
  });
});