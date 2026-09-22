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

export type WaiterInfo = {
  waiterId: string;
  waiterName: string;
  tableId?: string;
  tableName?: string;
};

const EMPTY_CUSTOMER: CustomerInfo = { customerName: '', phone: '', address: '', description: '' };
const EMPTY_WAITER: WaiterInfo = { waiterId: '', waiterName: '' };

type CartContextType = {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  customer: CustomerInfo;
  waiter: WaiterInfo;
  isWaiterOrder: boolean;
  add: (product: Product) => void;
  addQuantity: (product: Product, quantity: number) => void;
  increase: (productId: string) => void;
  decrease: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  restore: (items: CartItem[], customer: CustomerInfo) => void;
  updateQuantity: (productId: string, quantityText: string) => void;
  setCustomerField: <K extends keyof CustomerInfo>(field: K, value: string) => void;
  setWaiterOrder: (isWaiter: boolean) => void;
  setWaiter: (waiter: WaiterInfo) => void;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY_CUSTOMER);
  const [waiter, setWaiterState] = useState<WaiterInfo>(EMPTY_WAITER);
  const [isWaiterOrder, setIsWaiterOrder] = useState(false);

  const add = useCallback((product: Product) => setItems((current) => addProductToCart(current, product)), []);
  const addQuantity = useCallback(
    (product: Product, quantity: number) =>
      setItems((current) => addQuantityToCart(current, product, quantity, product.stockQuantity)),
    [],
  );
  const increase = useCallback(
    (productId: string) =>
      setItems((current) => {
        const item = current.find((cartItem) => cartItem.product.id === productId);
        return increaseItem(current, productId, item?.product.stockQuantity);
      }),
    [],
  );
  const decrease = useCallback((productId: string) => setItems((current) => decreaseItem(current, productId)), []);
  const remove = useCallback((productId: string) => setItems((current) => removeItem(current, productId)), []);
  const clear = useCallback(() => {
    setItems(clearCart());
    setCustomer(EMPTY_CUSTOMER);
    setWaiterState(EMPTY_WAITER);
    setIsWaiterOrder(false);
  }, []);

  const updateQuantity = useCallback(
    (productId: string, quantityText: string) =>
      setItems((current) => {
        const item = current.find((cartItem) => cartItem.product.id === productId);
        return updateItemQuantity(current, productId, quantityText, item?.product.stockQuantity);
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

  const setWaiterOrder = useCallback((isWaiter: boolean) => {
    setIsWaiterOrder(isWaiter);
    if (!isWaiter) {
      setWaiterState(EMPTY_WAITER);
    }
  }, []);

  const setWaiter = useCallback((w: WaiterInfo) => {
    setWaiterState(w);
  }, []);

  const value = useMemo(
    () => ({
      items,
      count: cartCount(items),
      subtotalCents: cartSubtotal(items),
      customer,
      waiter,
      isWaiterOrder,
      add,
      addQuantity,
      increase,
      decrease,
      remove,
      clear,
      restore,
      updateQuantity,
      setCustomerField,
      setWaiterOrder,
      setWaiter,
    }),
    [items, customer, waiter, isWaiterOrder, add, addQuantity, increase, decrease, remove, clear, restore, updateQuantity, setCustomerField, setWaiterOrder, setWaiter],
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