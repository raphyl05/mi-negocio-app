import type { Product } from '../models/product';
import { calcSubtotal } from './money';

export type CartItem = {
  product: Product;
  quantity: number;
};

export function addProductToCart(items: CartItem[], product: Product): CartItem[] {
  const existing = items.find((item) => item.product.id === product.id);
  if (existing) {
    return items.map((item) =>
      item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
    );
  }
  return [...items, { product, quantity: 1 }];
}

export function increaseItem(items: CartItem[], productId: string): CartItem[] {
  return items.map((item) =>
    item.product.id === productId ? { ...item, quantity: item.quantity + 1 } : item,
  );
}

export function decreaseItem(items: CartItem[], productId: string): CartItem[] {
  return items
    .map((item) =>
      item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item,
    )
    .filter((item) => item.quantity > 0);
}

export function removeItem(items: CartItem[], productId: string): CartItem[] {
  return items.filter((item) => item.product.id !== productId);
}

export const clearCart = () => [];

export function cartSubtotal(items: CartItem[]): number {
  return calcSubtotal(
    items.map((item) => ({ unitPriceCents: item.product.priceCents, quantity: item.quantity })),
  );
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}