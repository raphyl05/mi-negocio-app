import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Product } from '../models/product';
import { addProductToCart, cartCount, cartSubtotal } from '../utils/cart';
import type { CartItem } from '../utils/cart';

type CartContextType = {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  add: (product: Product) => void;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = (product: Product) => setItems((current) => addProductToCart(current, product));

  const value = useMemo(
    () => ({
      items,
      count: cartCount(items),
      subtotalCents: cartSubtotal(items),
      add,
    }),
    [items],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart debe usarse dentro de CartProvider');
  }
  return ctx;
}