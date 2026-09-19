import {
  addProductToCart,
  addQuantityToCart,
  cartCount,
  cartSubtotal,
  clearCart,
  decreaseItem,
  findStockIssue,
  increaseItem,
  inCartQuantity,
  parseCartQuantity,
  removeItem,
  updateItemQuantity,
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
  stockQuantity: 15,
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

  it('parseCartQuantity interpreta la cantidad escrita', () => {
    expect(parseCartQuantity('3')).toBe(3);
    expect(parseCartQuantity('12')).toBe(12);
    expect(parseCartQuantity('')).toBe(1);
    expect(parseCartQuantity('abc')).toBe(1);
    expect(parseCartQuantity('0')).toBe(1);
    expect(parseCartQuantity('-2')).toBe(1);
  });

  it('inCartQuantity devuelve la cantidad actual de un producto', () => {
    const items: CartItem[] = [{ product: burger, quantity: 4 }];
    expect(inCartQuantity(items, 'p1')).toBe(4);
    expect(inCartQuantity(items, 'p2')).toBe(0);
  });

  it('addQuantityToCart agrega varias unidades de una sola vez', () => {
    const result = addQuantityToCart([], burger, 5);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(5);
  });

  it('addQuantityToCart no excede el stock disponible y respeta lo ya agregado', () => {
    const items: CartItem[] = [{ product: burger, quantity: 10 }];
    const result = addQuantityToCart(items, burger, 20, burger.stockQuantity);
    expect(result[0].quantity).toBe(15);
  });

  it('addQuantityToCart no agrega más allá del stock tras dos toques rápidos', () => {
    const first = addQuantityToCart([], burger, 10, burger.stockQuantity);
    const second = addQuantityToCart(first, burger, 10, burger.stockQuantity);
    expect(second[0].quantity).toBe(15);
  });

  it('increaseItem respeta el tope de stock', () => {
    const items: CartItem[] = [{ product: burger, quantity: 15 }];
    expect(increaseItem(items, 'p1', burger.stockQuantity)[0].quantity).toBe(15);
    expect(increaseItem([{ product: burger, quantity: 14 }], 'p1', burger.stockQuantity)[0].quantity).toBe(15);
  });

  it('updateItemQuantity recorta la cantidad escrita al stock máximo', () => {
    const items: CartItem[] = [{ product: burger, quantity: 1 }];
    const result = updateItemQuantity(items, 'p1', '100', burger.stockQuantity);
    expect(result[0].quantity).toBe(15);
  });

  it('findStockIssue detecta un producto que excede su stock', () => {
    const items: CartItem[] = [{ product: burger, quantity: 20 }];
    const issue = findStockIssue(items, [burger]);
    expect(issue).not.toBeNull();
    expect(issue?.available).toBe(15);
  });

  it('findStockIssue ignora productos dentro del stock', () => {
    expect(findStockIssue([{ product: burger, quantity: 5 }], [burger])).toBeNull();
  });

  it('findStockIssue detecta stock insuficiente para productos sin stock', () => {
    expect(findStockIssue([{ product: soda, quantity: 1 }], [soda])).not.toBeNull();
  });
});