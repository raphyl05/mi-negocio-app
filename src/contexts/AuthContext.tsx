import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  apiLogin,
  apiLogout as apiLogoutRemote,
  apiSession,
  apiRefresh,
  apiRegister,
  getTokens,
  clearTokens,
  type LoginResponse,
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

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  login: (identifier: string, password: string, deviceId: string) => Promise<{ ok: boolean; error?: { code: string; message: string } }>;
  register: (name: string, username: string, password: string, deviceId: string) => Promise<{ ok: boolean; error?: { code: string; message: string } }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
};

const TOKEN_KEY_ACCESS = '@micaja/accessToken';
const TOKEN_KEY_REFRESH = '@micaja/refreshToken';
const TOKEN_KEY_EXP = '@micaja/accessExp';

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
  logout: async () => {},
  refreshSession: async () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, login, register, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
