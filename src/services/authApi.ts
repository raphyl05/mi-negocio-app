import { apiUrl, API_PREFIX } from '../config/api';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY_ACCESS = 'vendelo.accessToken';
const TOKEN_KEY_REFRESH = 'vendelo.refreshToken';
const TOKEN_KEY_EXP = 'vendelo.accessExp';
const USER_KEY = 'vendelo.sessionUser';
const ACTIVE_BUSINESS_KEY = 'vendelo.activeBusinessId';

export type DeviceInfo = {
  id: string;
  name: string;
  role: string | null;
  active: boolean;
  registeredAt: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; username: string; createdAt: string };
  businesses: Array<{ id: string; name: string; role: string }>;
};

export type RegisterResponse = LoginResponse;

export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type SessionResponse = {
  user: { id: string; username: string; createdAt: string };
  businesses: Array<{ id: string; name: string; role: string }>;
};

export type BusinessCapabilities = {
  restaurant: boolean;
  waiters: boolean;
  tables: boolean;
  kitchen: boolean;
  kitchenPrinting: boolean;
};

export type CapabilitiesResponse = {
  businessType: string;
  capabilities: BusinessCapabilities;
  settings: Record<string, unknown>;
  capabilityVersion: number;
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
    SecureStore.deleteItemAsync(ACTIVE_BUSINESS_KEY),
  ]);
}

export async function saveActiveBusinessId(businessId: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_BUSINESS_KEY, businessId);
}

export async function getActiveBusinessId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_BUSINESS_KEY);
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

// Sondeo rápido de conectividad con el backend. Devuelve true si el servidor
// responde cualquier HTTP (aunque sea 404/401); false solo ante error de red o
// timeout. Sirve para no esperar el timeout completo del login/registro cuando
// no hay backend alcanzable.
export async function isApiReachable(timeoutMs = 2500): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = apiUrl(`${API_PREFIX}/health`);
    await fetch(url, { method: 'GET', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
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
      body: JSON.stringify({ refreshToken: refresh, businessId: (await getActiveBusinessId()) || undefined }),
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
  deviceId: string,
  deviceRole?: string
): Promise<{ ok: boolean; data?: LoginResponse; error?: { code: string; message: string } }> {
  const res = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { identifier, password, deviceId, deviceRole: deviceRole || undefined },
    timeout: 8000,
  });
  if (res.data) {
    await saveTokens(res.data.accessToken, res.data.refreshToken, res.data.expiresIn);
    if (res.data.businesses[0]?.id) {
      await saveActiveBusinessId(res.data.businesses[0].id);
    }
  }
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiRegister(
  name: string,
  username: string,
  password: string,
  deviceId: string,
  businessType = 'COMMERCE',
  ownerName?: string,
  opts: { email?: string; phone?: string } = {}
): Promise<{ ok: boolean; data?: RegisterResponse; error?: { code: string; message: string } }> {
  const res = await apiFetch<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: {
      identifier: username,
      email: opts.email?.trim() || undefined,
      phone: opts.phone?.trim() || undefined,
      password,
      deviceId,
      name,
      ownerName,
      businessType,
      businessId: '',
      capabilities: {},
      deviceName: 'Device',
    },
    timeout: 8000,
  });
  if (res.data) {
    await saveTokens(res.data.accessToken, res.data.refreshToken, res.data.expiresIn);
    if (res.data.businesses[0]?.id) {
      await saveActiveBusinessId(res.data.businesses[0].id);
    }
  }
  return { ok: !!res.data, data: res.data, error: res.error };
}

export type RecoveryRequestResponse = {
  message: string;
  expiresInMinutes?: number;
  debugCode?: string | null;
};

export async function apiRecoveryRequest(
  identifier: string
): Promise<{ ok: boolean; data?: RecoveryRequestResponse; error?: { code: string; message: string } }> {
  if (!(await isApiReachable())) {
    return { ok: false, error: { code: 'NETWORK', message: 'Sin conexión con el servidor.' } };
  }
  const res = await apiFetch<RecoveryRequestResponse>('/auth/recovery/request', {
    method: 'POST',
    body: { identifier },
    timeout: 8000,
  });
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiRecoveryVerify(
  identifier: string,
  code: string
): Promise<{ ok: boolean; data?: { recoveryToken: string; expiresInMinutes: number }; error?: { code: string; message: string } }> {
  const res = await apiFetch<{ recoveryToken: string; expiresInMinutes: number }>('/auth/recovery/verify', {
    method: 'POST',
    body: { identifier, code },
    timeout: 8000,
  });
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiRecoveryResetPassword(
  recoveryToken: string,
  newPassword: string
): Promise<{ ok: boolean; error?: { code: string; message: string } }> {
  const res = await apiFetch('/auth/recovery/reset-password', {
    method: 'POST',
    body: { recoveryToken, newPassword },
    timeout: 8000,
  });
  return { ok: res.status === 204 || !!res.data, error: res.error };
}

export type CloudBackupInfo = { id: string; businessId: string; createdAt: string };

export async function apiListCloudBackups(
  businessId: string
): Promise<{ ok: boolean; data?: CloudBackupInfo[]; error?: { code: string; message: string } }> {
  const res = await apiFetch<CloudBackupInfo[]>(`/businesses/${businessId}/backups`);
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiUploadCloudBackup(
  businessId: string,
  payloadJson: string
): Promise<{ ok: boolean; data?: CloudBackupInfo; error?: { code: string; message: string } }> {
  const res = await apiFetch<CloudBackupInfo>(`/businesses/${businessId}/backups/self`, {
    method: 'PUT',
    body: { payload: payloadJson },
    timeout: 20000,
  });
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiDownloadCloudBackup(
  businessId: string
): Promise<{ ok: boolean; data?: { id: string; createdAt: string; payload: unknown }; error?: { code: string; message: string } }> {
  const res = await apiFetch<{ id: string; createdAt: string; payload: unknown }>(
    `/businesses/${businessId}/backups/self/latest`
  );
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiUpdateCapabilities(
  businessId: string,
  body: {
    expectedCapabilityVersion?: number;
    businessType?: string;
    capabilities: Record<string, boolean>;
  }
): Promise<{ ok: boolean; data?: CapabilitiesResponse; error?: { code: string; message: string } }> {
  const res = await apiFetch<CapabilitiesResponse>(`/businesses/${businessId}/capabilities`, {
    method: 'PATCH',
    body,
    timeout: 10000,
  });
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiRefresh(businessId?: string): Promise<{ ok: boolean; data?: RefreshResponse; error?: { code: string; message: string } }> {
  const { refresh } = await getTokens();
  if (!refresh) return { ok: false };
  const res = await apiFetch<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: refresh, businessId: businessId || undefined },
  });
  if (res.data) {
    await saveTokens(res.data.accessToken, res.data.refreshToken, res.data.expiresIn);
  }
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiSession(): Promise<{ ok: boolean; data?: SessionResponse; error?: { code: string; message: string } }> {
  const res = await apiFetch<SessionResponse>('/auth/session');
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiGetCapabilities(businessId: string): Promise<{ ok: boolean; data?: CapabilitiesResponse; error?: { code: string; message: string } }> {
  const res = await apiFetch<CapabilitiesResponse>(`/businesses/${businessId}/capabilities`);
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiListDevices(
  businessId: string
): Promise<{ ok: boolean; data?: DeviceInfo[]; error?: { code: string; message: string } }> {
  const res = await apiFetch<DeviceInfo[]>(`/businesses/${businessId}/devices`);
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiRevokeDevice(
  businessId: string,
  deviceId: string
): Promise<{ ok: boolean; data?: { revoked: boolean; deviceId: string }; error?: { code: string; message: string } }> {
  const res = await apiFetch<{ revoked: boolean; deviceId: string }>(
    `/businesses/${businessId}/devices/${deviceId}/revoke`,
    { method: 'PATCH' }
  );
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiSwitchBusiness(
  businessId: string,
  deviceName?: string
): Promise<{ ok: boolean; data?: LoginResponse; error?: { code: string; message: string } }> {
  const res = await apiFetch<LoginResponse>('/auth/switch-business', {
    method: 'POST',
    body: { businessId, deviceName: deviceName || undefined },
    timeout: 8000,
  });
  if (res.data) {
    await saveTokens(res.data.accessToken, res.data.refreshToken, res.data.expiresIn);
    await saveActiveBusinessId(businessId);
  }
  return { ok: !!res.data, data: res.data, error: res.error };
}

export async function apiLogout(): Promise<void> {
  await clearTokens();
}

export { clearTokens, getTokens };
