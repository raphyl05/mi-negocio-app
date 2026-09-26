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
  apiSwitchBusiness,
  saveActiveBusinessId,
  getActiveBusinessId,
  isApiReachable,
  getTokens,
  clearTokens,
  type LoginResponse,
  type CapabilitiesResponse,
} from '../services/authApi';
import { verifyLogin } from '../services/setupService';
import {
  saveOfflineSession,
  loadOfflineSession,
  clearOfflineSession,
  sessionFromSnapshot,
} from '../utils/sessionStore';

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
  activeBusinessId?: string;
  offline?: boolean;
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
  login: (identifier: string, password: string, deviceId: string, deviceRole?: string) => Promise<{ ok: boolean; error?: { code: string; message: string } }>;
  register: (name: string, username: string, password: string, deviceId: string, opts?: { email?: string; phone?: string }) => Promise<{ ok: boolean; error?: { code: string; message: string } }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  switchBusiness: (businessId: string) => Promise<{ ok: boolean; error?: { code: string; message: string } }>;
  fetchCapabilities: (businessId: string) => Promise<BusinessCapabilities | null>;
  setCapabilitiesCache: (businessId: string, caps: BusinessCapabilities) => void;
  hasCapability: (businessId: string, key: keyof BusinessCapabilities) => boolean;
};

const TOKEN_KEY_ACCESS = 'vendelo.accessToken';
const TOKEN_KEY_REFRESH = 'vendelo.refreshToken';
const TOKEN_KEY_EXP = 'vendelo.accessExp';

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  capabilities: {},
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: async () => {},
  refreshSession: async () => false,
  switchBusiness: async () => ({ ok: false }),
  fetchCapabilities: async () => null,
  setCapabilitiesCache: () => {},
  hasCapability: () => false,
});

function isOfflineError(error?: { code: string; message: string } | null): boolean {
  return error?.code === 'NETWORK';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<Record<string, BusinessCapabilities>>({});
  const sessionRef = useRef<AuthSession | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storeSession = useCallback((next: AuthSession | null | ((prev: AuthSession | null) => AuthSession | null)) => {
    setSession(next);
    const resolved =
      typeof next === 'function' ? (next as (prev: AuthSession | null) => AuthSession | null)(sessionRef.current) : next;
    sessionRef.current = resolved;
    if (!resolved) {
      void clearOfflineSession().catch(() => { /* best effort */ });
    } else {
      void saveOfflineSession({ user: resolved.user, offline: !!resolved.offline }).catch(() => { /* best effort */ });
    }
  }, []);

  const scheduleRefresh = useCallback((expiresIn: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const refreshIn = Math.max((expiresIn - 60) * 1000, 10000);
    refreshTimerRef.current = setTimeout(async () => {
      const ok = await refreshSession();
      if (!ok) storeSession(null);
    }, refreshIn);
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const { access, refresh } = await getTokens();
      if (!access || !refresh) {
        const snapshot = await loadOfflineSession();
        if (snapshot) {
          storeSession(sessionFromSnapshot(snapshot));
        }
        setLoading(false);
        return;
      }
      const res = await apiSession();
      if (res.data && res.ok) {
        const tokens = await getTokens();
        const stored = await getActiveBusinessId();
        const businesses = res.data.businesses;
        const activeBusinessId =
          (stored && businesses.some((b) => b.id === stored))
            ? stored
            : businesses[0]?.id;
        storeSession({
          user: res.data.user,
          accessToken: tokens.access!,
          refreshToken: tokens.refresh!,
          expiresIn: 900,
          businesses,
          activeBusinessId,
        });
      } else if (isOfflineError(res.error)) {
        const snapshot = await loadOfflineSession();
        if (snapshot) {
          storeSession(sessionFromSnapshot(snapshot));
        } else {
          await clearTokens();
        }
      } else {
        await clearTokens();
        await clearOfflineSession();
      }
    } catch {
      await clearTokens();
      await clearOfflineSession();
    } finally {
      setLoading(false);
    }
  }, [storeSession]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const current = sessionRef.current;
    if (current?.offline) return true;
    try {
      const res = await apiRefresh(current?.activeBusinessId);
      if (res.data && res.ok) {
        storeSession((prev) =>
          prev
            ? {
                ...prev,
                expiresIn: res.data!.expiresIn,
                activeBusinessId: current?.activeBusinessId ?? prev.activeBusinessId,
              }
            : null
        );
        return true;
      }
      if (isOfflineError(res.error)) return current != null;
      await clearTokens();
      storeSession(null);
      return false;
    } catch {
      return current != null;
    }
  }, []);

  const login = useCallback(
    async (identifier: string, password: string, deviceId: string, deviceRole?: string) => {
      if (!(await isApiReachable())) {
        const local = await verifyLogin(identifier, password);
        if (local) {
          storeSession({
            user: { id: local.id, username: local.username, createdAt: local.createdAt },
            accessToken: '',
            refreshToken: '',
            expiresIn: 0,
            businesses: [],
            offline: true,
          });
          return { ok: true };
        }
        return { ok: false, error: { code: 'AUTH', message: 'Usuario o contraseña incorrectos.' } };
      }
      const res = await apiLogin(identifier, password, deviceId, deviceRole);
      if (res.data) {
        const { accessToken, refreshToken, expiresIn } = res.data;
        const businesses = res.data.businesses || [];
        storeSession({
          user: res.data.user,
          accessToken,
          refreshToken,
          expiresIn,
          businesses,
          activeBusinessId: businesses[0]?.id,
        });
        scheduleRefresh(expiresIn);
        return { ok: true };
      }
      // Fallback offline-first: si el servidor rechaza o está caído, se cae a la
      // cuenta guardada en este dispositivo (usuario, correo o teléfono local).
      const local = await verifyLogin(identifier, password);
      if (local) {
        storeSession({
          user: { id: local.id, username: local.username, createdAt: local.createdAt },
          accessToken: '',
          refreshToken: '',
          expiresIn: 0,
          businesses: [],
          offline: true,
        });
        return { ok: true };
      }
      return { ok: false, error: res.error || { code: 'AUTH', message: 'Usuario o contraseña incorrectos.' } };
    },
    [scheduleRefresh, storeSession]
  );

  const register = useCallback(
    async (
      name: string,
      username: string,
      password: string,
      deviceId: string,
      opts?: { email?: string; phone?: string }
    ) => {
      const res = await apiRegister(name, username, password, deviceId, 'COMMERCE', undefined, {
        email: opts?.email,
        phone: opts?.phone,
      });
      if (res.data) {
        const { accessToken, refreshToken, expiresIn } = res.data;
        const businesses = res.data.businesses || [];
        storeSession({
          user: res.data.user,
          accessToken,
          refreshToken,
          expiresIn,
          businesses,
          activeBusinessId: businesses[0]?.id,
        });
        scheduleRefresh(expiresIn);
      }
      return { ok: res.ok, error: res.error };
    },
    [scheduleRefresh, storeSession]
  );

  const logout = useCallback(async () => {
    try { await apiLogoutRemote(); } catch { /* ignore */ }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    await clearTokens();
    storeSession(null);
  }, []);

  const switchBusiness = useCallback(
    async (businessId: string): Promise<{ ok: boolean; error?: { code: string; message: string } }> => {
      const current = sessionRef.current;
      if (!current || current.offline) {
        return { ok: false, error: { code: 'AUTH', message: 'Conecta tu cuenta y vuelve a intentarlo.' } };
      }
      const res = await apiSwitchBusiness(businessId);
      if (res.data) {
        const businesses = res.data.businesses || [];
        storeSession({
          user: res.data.user,
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          expiresIn: res.data.expiresIn,
          businesses,
          activeBusinessId: businessId,
        });
        scheduleRefresh(res.data.expiresIn);
        return { ok: true };
      }
      return { ok: false, error: res.error };
    },
    [scheduleRefresh, storeSession]
  );

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

  const setCapabilitiesCache = useCallback((businessId: string, caps: BusinessCapabilities) => {
    setCapabilities((prev) => ({ ...prev, [businessId]: caps }));
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, capabilities, login, register, logout, refreshSession, switchBusiness, fetchCapabilities, setCapabilitiesCache, hasCapability }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
