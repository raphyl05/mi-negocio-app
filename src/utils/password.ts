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

export function generateId(): string {
  return Crypto.randomUUID();
}