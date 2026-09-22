export const API_BASE_URL =
  (globalThis as Record<string, unknown>).__API_URL__ ||
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://127.0.0.1:5000';

export const API_PREFIX = '/api/v1';

export function apiUrl(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}
