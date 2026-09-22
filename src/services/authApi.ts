import { apiUrl, API_PREFIX } from '../config/api';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY_ACCESS = '@micaja/accessToken';
const TOKEN_KEY_REFRESH = '@micaja/refreshToken';
const TOKEN_KEY_EXP = '@micaja/accessExp';
const USER_KEY = '@micaja/sessionUser';

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; username: string; createdAt: string };
};

export type RegisterResponse = LoginResponse & {
  businesses: Array<{ id: string; name: string; role: string }>;
};

export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type SessionResponse = {
  user: { id: string; username: string; createdAt: string };
  businesses: Array<{ id: string; name: string; role: string }>;
};

async function getTokens(): Promise<{ access: string | null; refresh: string | null }> {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY_ACCESS),
    SecureStore.getItemAsync(TOKEN_KEY_REFRESH),
  ]);
  return { access, refresh };
}

async function saveTokens(access: string, refresh: string, expiresIn: number): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY_ACCESS, access),
    SecureStore.setItemAsync(TOKEN_KEY_REFRESH, refresh),
    SecureStore.setItemAsync(TOKEN_KEY_EXP, String(Date.now() + expiresIn * 1000)),
  ]);
}

async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY_ACCESS),
    SecureStore.deleteItemAsync(TOKEN_KEY_REFRESH),
    SecureStore.deleteItemAsync(TOKEN_KEY_EXP),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

function getAuthHeaders(accessToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string>; timeout?: number } = {}
): Promise<{ status: number; data?: T; error?: { code: string; message: string } }> {
  const { method = 'GET', body, headers: extraHeaders, timeout = 15000 } = options;
  const url = apiUrl(`${API_PREFIX}${path}`);
  const { access } = await getTokens();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method,
      headers: { ...getAuthHeaders(access), ...extraHeaders },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/register') {
      const refreshed = await tryRefresh();
      if (refreshed) {
        return apiFetch<T>(path, options);
      }
    }
    let data: T | undefined;
    if (res.status !== 204) {
      try { data = (await res.json()) as T; } catch { data = undefined; }
    }
    if (!res.ok) {
      return { status: res.status, error: (data as { code: string; message: string }) || { code: 'UNKNOWN', message: `HTTP ${res.status}` } };
    }
    return { status: res.status, data };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : 'Network error';
    return { status: 0, error: { code: 'NETWORK', message: msg } };
  }
}

async function tryRefresh(): Promise<boolean> {
  const { access, refresh } = await getTokens();
  if (!refresh) return false;
  try {
    const url = apiUrl(`${API_PREFIX}/auth/refresh`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders(access) },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (res.ok) {
      const body = (await res.json()) as RefreshResponse;
      await saveTokens(body.accessToken, body.refreshToken, body.expiresIn);
      return true;
    }
    await clearTokens();
    return false;
  } catch {
    return false;
  }
}

export async function apiLogin(
  identifier: string,
  password: string,
  deviceId: string
): Promise<{ ok: boolean; data?: LoginResponse; error?: { code: string; message: string } }> {
  const res = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { identifier, password, deviceId },
  });
  if (res.data) {
    await saveTokens(res.data.accessToken, res.data.refreshToken, res.data.expiresIn);
  }
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiRegister(
  name: string,
  username: string,
  password: string,
  deviceId: string,
  businessType = 'COMMERCE',
  ownerName?: string
): Promise<{ ok: boolean; data?: RegisterResponse; error?: { code: string; message: string } }> {
  const res = await apiFetch<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: { identifier: username, password, deviceId, name, ownerName, businessType, businessId: '', capabilities: {}, deviceName: 'Device' },
  });
  if (res.data) {
    await saveTokens(res.data.accessToken, res.data.refreshToken, res.data.expiresIn);
  }
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiRefresh(): Promise<{ ok: boolean; data?: RefreshResponse; error?: { code: string; message: string } }> {
  const { refresh } = await getTokens();
  if (!refresh) return { ok: false };
  const res = await apiFetch<RefreshResponse>('/auth/refresh', { method: 'POST', body: { refreshToken: refresh } });
  if (res.data) {
    await saveTokens(res.data.accessToken, res.data.refreshToken, res.data.expiresIn);
  }
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiSession(): Promise<{ ok: boolean; data?: SessionResponse; error?: { code: string; message: string } }> {
  const res = await apiFetch<SessionResponse>('/auth/session');
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiLogout(): Promise<void> {
  await clearTokens();
}

export { clearTokens, getTokens };
