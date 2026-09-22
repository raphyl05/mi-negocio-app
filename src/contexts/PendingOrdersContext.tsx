import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { orderRepository } from '../repositories/orderRepository';

type PendingOrdersContextType = {
  pendingCount: number;
  refreshPending: () => Promise<void>;
};

const PendingOrdersContext = createContext<PendingOrdersContextType | null>(null);

export function PendingOrdersProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const inFlight = useRef(false);

  const refreshPending = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const pending = await orderRepository.listPending();
      setPendingCount(pending.length);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const value = useMemo(() => ({ pendingCount, refreshPending }), [pendingCount, refreshPending]);

  return <PendingOrdersContext.Provider value={value}>{children}</PendingOrdersContext.Provider>;
}

export function usePendingOrders(): PendingOrdersContextType {
  const ctx = useContext(PendingOrdersContext);
  if (!ctx) {
    throw new Error('usePendingOrders debe usarse dentro de PendingOrdersProvider');
  }
  return ctx;
}