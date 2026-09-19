import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Product } from '../models/product';
import {
  addProductToCart,
  addQuantityToCart,
  cartCount,
  cartSubtotal,
  clearCart,
  decreaseItem,
  increaseItem,
  removeItem,
  updateItemQuantity,
} from '../utils/cart';
import type { CartItem } from '../utils/cart';

export type CustomerInfo = {
  customerName: string;
  phone: string;
  address: string;
  description: string;
};

const EMPTY_CUSTOMER: CustomerInfo = { customerName: '', phone: '', address: '', description: '' };

function stockCap(product: Product): number | undefined {
  return product.trackStock ? product.stockQuantity : undefined;
}

type CartContextType = {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  customer: CustomerInfo;
  add: (product: Product) => void;
  addQuantity: (product: Product, quantity: number) => void;
  increase: (productId: string) => void;
  decrease: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  restore: (items: CartItem[], customer: CustomerInfo) => void;
  updateQuantity: (productId: string, quantityText: string) => void;
  setCustomerField: <K extends keyof CustomerInfo>(field: K, value: string) => void;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY_CUSTOMER);

  const add = useCallback((product: Product) => setItems((current) => addProductToCart(current, product)), []);
  const addQuantity = useCallback(
    (product: Product, quantity: number) =>
      setItems((current) => addQuantityToCart(current, product, quantity, stockCap(product))),
    [],
  );
  const increase = useCallback(
    (productId: string) =>
      setItems((current) => {
        const item = current.find((cartItem) => cartItem.product.id === productId);
        return increaseItem(current, productId, item ? stockCap(item.product) : undefined);
      }),
    [],
  );
  const decrease = useCallback((productId: string) => setItems((current) => decreaseItem(current, productId)), []);
  const remove = useCallback((productId: string) => setItems((current) => removeItem(current, productId)), []);
  const clear = useCallback(() => setItems(clearCart()), []);

  const updateQuantity = useCallback(
    (productId: string, quantityText: string) =>
      setItems((current) => {
        const item = current.find((cartItem) => cartItem.product.id === productId);
        return updateItemQuantity(current, productId, quantityText, item ? stockCap(item.product) : undefined);
      }),
    [],
  );

  const restore = useCallback((newItems: CartItem[], newCustomer: CustomerInfo) => {
    setItems(newItems);
    setCustomer(newCustomer);
  }, []);

  const setCustomerField = useCallback(
    <K extends keyof CustomerInfo>(field: K, value: string) =>
      setCustomer((current) => ({ ...current, [field]: value })),
    [],
  );

  const value = useMemo(
    () => ({
      items,
      count: cartCount(items),
      subtotalCents: cartSubtotal(items),
      customer,
      add,
      addQuantity,
      increase,
      decrease,
      remove,
      clear,
      restore,
      updateQuantity,
      setCustomerField,
    }),
    [items, customer, add, addQuantity, increase, decrease, remove, clear, restore, updateQuantity, setCustomerField],
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