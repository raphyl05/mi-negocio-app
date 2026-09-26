import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from 'expo-auth-session';
import type { BackupBundle } from '../utils/backup';
import { buildBackupBundle, applyRestoredBundle } from './backupService';

const TOKEN_KEY = '@vendelo/driveToken';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

// TODO: configurar en Google Cloud Console (OAuth 2.0 Client ID, tipo 'Aplicación web' + 'Aplicación iOS/Android').
export const GOOGLE_CLIENT_ID = '';

export type DriveAccount = { connected: false } | { connected: true; email: string; updatedAt: string };

function getRedirectUri(): string {
  return makeRedirectUri();
}

function randomString(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function sha256Base64Url(input: string): Promise<string> {
  const base64 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function buildPKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomString(64);
  const challenge = await sha256Base64Url(verifier);
  return { verifier, challenge };
}

async function loadToken(): Promise<{ accessToken: string; refreshToken?: string; email?: string; updatedAt: string } | null> {
  const raw = await AsyncStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

async function saveToken(token: { accessToken: string; refreshToken?: string; email?: string }): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify({ ...token, updatedAt: new Date().toISOString() }));
}

async function refreshIfNeeded(token: { accessToken: string; refreshToken?: string }): Promise<{ accessToken: string; refreshToken?: string }> {
  if (!token.refreshToken) return token;
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || 'No se pudo renovar el token.');
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? token.refreshToken };
}

async function userEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  return data.email ?? 'Google';
}

export async function getDriveStatus(): Promise<DriveAccount> {
  const token = await loadToken();
  if (!token) return { connected: false };
  try {
    const email = await userEmail(token.accessToken);
    return { connected: true, email, updatedAt: token.updatedAt };
  } catch {
    return { connected: false };
  }
}

export async function signInDrive(): Promise<{ ok: true; email: string } | { ok: false; message: string }> {
  if (!GOOGLE_CLIENT_ID) return { ok: false, message: 'Configura GOOGLE_CLIENT_ID en driveService.ts' };
  try {
    const redirectUri = getRedirectUri();
    const { verifier, challenge } = await buildPKCE();
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    if (result.type !== 'success') return { ok: false, message: 'OAuth cancelado.' };
    const code = (result as { params?: { code?: string } }).params?.code;
    if (!code) return { ok: false, message: 'No se recibió código de autorización.' };
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: GOOGLE_CLIENT_ID, redirect_uri: redirectUri,
        grant_type: 'authorization_code', code_verifier: verifier,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return { ok: false, message: tokenData.error_description || 'Error al autenticar.' };
    const email = await userEmail(tokenData.access_token);
    await saveToken({ accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token, email });
    return { ok: true, email };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Error al vincular.' };
  }
}

export async function signOutDrive(): Promise<void> {
  const token = await loadToken();
  if (token?.refreshToken) {
    try {
      await fetch(`${GOOGLE_TOKEN_URL}/revoke?token=${token.refreshToken}`);
    } catch { /* ignorar */ }
  }
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function uploadBackup(bundle: BackupBundle): Promise<{ ok: true; fileId: string } | { ok: false; message: string }> {
  const token = await loadToken();
  if (!token) return { ok: false, message: 'Vincular cuenta de Google primero.' };
  try {
    const fresh = await refreshIfNeeded(token);
    await saveToken({ ...fresh, email: token.email });
    const fileName = `vendelo-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const boundary = `----${Math.random().toString(36).slice(2)}`;
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name: fileName, mimeType: 'application/json' }),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      JSON.stringify(bundle),
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const res = await fetch(DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fresh.accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, message: err.error?.message || `Error ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, fileId: data.id };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Error al subir.' };
  }
}

export type DriveBackupItem = { id: string; name: string; modifiedTime: string };

export async function listBackups(): Promise<{ ok: true; items: DriveBackupItem[] } | { ok: false; message: string }> {
  const token = await loadToken();
  if (!token) return { ok: false, message: 'Vincular cuenta de Google primero.' };
  try {
    const fresh = await refreshIfNeeded(token);
    await saveToken({ ...fresh, email: token.email });
    const url = `${DRIVE_FILES_URL}?q=mimeType%3D'application/json'+and+name+contains+'vendelo-backup'&orderBy=modifiedTime%20desc&maxResults=20`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${fresh.accessToken}` } });
    if (!res.ok) return { ok: false, message: `Error ${res.status}` };
    const data = await res.json();
    return { ok: true, items: (data.files ?? []).map((f: { id: string; name: string; modifiedTime: string }) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime })) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Error al listar.' };
  }
}

export async function downloadBackup(fileId: string): Promise<{ ok: true; bundle: BackupBundle; name: string } | { ok: false; message: string }> {
  const token = await loadToken();
  if (!token) return { ok: false, message: 'Vincular cuenta de Google primero.' };
  try {
    const fresh = await refreshIfNeeded(token);
    await saveToken({ ...fresh, email: token.email });
    const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${fresh.accessToken}` } });
    if (!res.ok) return { ok: false, message: `Error ${res.status}` };
    const json = await res.text();
    const { parseBackup } = await import('../utils/backup');
    const parsed = parseBackup(json);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    return { ok: true, bundle: parsed.bundle, name: 'backup' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Error al descargar.' };
  }
}

export { buildBackupBundle, applyRestoredBundle };
