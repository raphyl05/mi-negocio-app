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

export function inCartQuantity(items: CartItem[], productId: string): number {
  return items.find((item) => item.product.id === productId)?.quantity ?? 0;
}

export function addQuantityToCart(
  items: CartItem[],
  product: Product,
  quantity: number,
  maxStock?: number,
): CartItem[] {
  const inCart = inCartQuantity(items, product.id);
  const remaining = maxStock === undefined ? quantity : Math.max(0, maxStock - inCart);
  const toAdd = Math.min(quantity, remaining);
  if (toAdd <= 0) return items;
  if (inCart > 0) {
    return items.map((item) =>
      item.product.id === product.id ? { ...item, quantity: item.quantity + toAdd } : item,
    );
  }
  return [...items, { product, quantity: toAdd }];
}

export function increaseItem(items: CartItem[], productId: string, maxStock?: number): CartItem[] {
  return items.map((item) => {
    if (item.product.id !== productId) return item;
    if (maxStock !== undefined && item.quantity >= maxStock) return item;
    return { ...item, quantity: item.quantity + 1 };
  });
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

export function parseCartQuantity(text: string): number {
  const cleaned = text.trim();
  if (!/^\d+$/.test(cleaned)) return 1;
  const quantity = parseInt(cleaned, 10);
  return quantity > 0 ? quantity : 1;
}

export function updateItemQuantity(
  items: CartItem[],
  productId: string,
  quantityText: string,
  maxStock?: number,
): CartItem[] {
  const quantity = parseCartQuantity(quantityText);
  if (quantity <= 0) {
    return removeItem(items, productId);
  }
  const capped = maxStock === undefined ? quantity : Math.min(quantity, maxStock);
  return items.map((item) =>
    item.product.id === productId ? { ...item, quantity: capped } : item,
  );
}

export type StockIssue = {
  product: Product;
  available: number;
};

export function findStockIssue(items: CartItem[], products: Product[]): StockIssue | null {
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const item of items) {
    if (!item.product.trackStock) continue;
    const live = byId.get(item.product.id);
    const available = live?.stockQuantity ?? 0;
    if (available < item.quantity) {
      return { product: live ?? item.product, available };
    }
  }
  return null;
}