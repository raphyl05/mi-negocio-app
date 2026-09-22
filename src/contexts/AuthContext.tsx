import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  apiLogin,
  apiLogout as apiLogoutRemote,
  apiSession,
  apiRefresh,
  apiRegister,
  apiGetCapabilities,
  getTokens,
  clearTokens,
  type LoginResponse,
  type CapabilitiesResponse,
} from '../services/authApi';

export type AuthUser = {
  id: string;
  username: string;
  createdAt: string;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  businesses: Array<{ id: string; name: string; role: string }>;
};

export type BusinessCapabilities = {
  restaurant: boolean;
  waiters: boolean;
  tables: boolean;
  kitchen: boolean;
  kitchenPrinting: boolean;
};

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  capabilities: Record<string, BusinessCapabilities>;
  login: (identifier: string, password: string, deviceId: string) => Promise<{ ok: boolean; error?: { code: string; message: string } }>;
  register: (name: string, username: string, password: string, deviceId: string) => Promise<{ ok: boolean; error?: { code: string; message: string } }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  fetchCapabilities: (businessId: string) => Promise<BusinessCapabilities | null>;
  hasCapability: (businessId: string, key: keyof BusinessCapabilities) => boolean;
};

const TOKEN_KEY_ACCESS = '@micaja/accessToken';
const TOKEN_KEY_REFRESH = '@micaja/refreshToken';
const TOKEN_KEY_EXP = '@micaja/accessExp';

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  capabilities: {},
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: async () => {},
  refreshSession: async () => false,
  fetchCapabilities: async () => null,
  hasCapability: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<Record<string, BusinessCapabilities>>({});
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const refreshIn = Math.max((expiresIn - 60) * 1000, 10000);
    refreshTimerRef.current = setTimeout(async () => {
      const ok = await refreshSession();
      if (!ok) setSession(null);
    }, refreshIn);
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const { access, refresh } = await getTokens();
      if (!access || !refresh) {
        setLoading(false);
        return;
      }
      const res = await apiSession();
      if (res.data && res.ok) {
        const tokens = await getTokens();
        setSession({
          user: res.data.user,
          accessToken: tokens.access!,
          refreshToken: tokens.refresh!,
          expiresIn: 900,
          businesses: res.data.businesses,
        });
      } else {
        await clearTokens();
      }
    } catch {
      await clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await apiRefresh();
      if (res.data && res.ok) {
        setSession((prev) =>
          prev ? { ...prev, expiresIn: res.data!.expiresIn } : null
        );
        return true;
      }
      await clearTokens();
      setSession(null);
      return false;
    } catch {
      return false;
    }
  }, []);

  const login = useCallback(
    async (identifier: string, password: string, deviceId: string) => {
      const res = await apiLogin(identifier, password, deviceId);
      if (res.data) {
        const { accessToken, refreshToken, expiresIn } = res.data;
        setSession({
          user: res.data.user,
          accessToken,
          refreshToken,
          expiresIn,
          businesses: [],
        });
        scheduleRefresh(expiresIn);
      }
      return { ok: res.ok, error: res.error };
    },
    [scheduleRefresh]
  );

  const register = useCallback(
    async (name: string, username: string, password: string, deviceId: string) => {
      const res = await apiRegister(name, username, password, deviceId);
      if (res.data) {
        const { accessToken, refreshToken, expiresIn } = res.data;
        setSession({
          user: res.data.user,
          accessToken,
          refreshToken,
          expiresIn,
          businesses: res.data.businesses || [],
        });
        scheduleRefresh(expiresIn);
      }
      return { ok: res.ok, error: res.error };
    },
    [scheduleRefresh]
  );

  const logout = useCallback(async () => {
    try { await apiLogoutRemote(); } catch { /* ignore */ }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    await clearTokens();
    setSession(null);
  }, []);

  const fetchCapabilities = useCallback(async (businessId: string): Promise<BusinessCapabilities | null> => {
    try {
      const res = await apiGetCapabilities(businessId);
      if (res.data) {
        const caps: BusinessCapabilities = {
          restaurant: !!res.data.capabilities.restaurant,
          waiters: !!res.data.capabilities.waiters,
          tables: !!res.data.capabilities.tables,
          kitchen: !!res.data.capabilities.kitchen,
          kitchenPrinting: !!res.data.capabilities.kitchenPrinting,
        };
        setCapabilities((prev) => ({ ...prev, [businessId]: caps }));
        return caps;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  const hasCapability = useCallback((businessId: string, key: keyof BusinessCapabilities): boolean => {
    return capabilities[businessId]?.[key] ?? false;
  }, [capabilities]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, capabilities, login, register, logout, refreshSession, fetchCapabilities, hasCapability }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
