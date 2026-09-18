import * as Crypto from 'expo-crypto';

export async function hashPassword(password: string, salt: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}${password}`);
  return digest;
}

export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fallbackId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function generateId(): string {
  try {
    const id = Crypto.randomUUID();
    return id || fallbackId();
  } catch {
    return fallbackId();
  }
}