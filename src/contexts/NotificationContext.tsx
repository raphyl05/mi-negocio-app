import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export type Notification = {
  id: string;
  message: string;
  type: NotificationType;
};

type NotificationContextType = {
  notifications: Notification[];
  notify: (message: string, type?: NotificationType) => void;
  dismiss: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

let nextId = 0;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const notify = useCallback((message: string, type: NotificationType = 'info') => {
    const id = `n${++nextId}`;
    const notification: Notification = { id, message, type };
    setNotifications((prev) => [...prev, notification]);
    const timer = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      delete timersRef.current[id];
    }, 3500);
    timersRef.current[id] = timer;
  }, []);

  const value: NotificationContextType = { notifications, notify, dismiss };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications debe usarse dentro de NotificationProvider');
  return ctx;
}
