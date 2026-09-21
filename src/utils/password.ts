import * as Crypto from 'expo-crypto';

export const PASSWORD_PREFIX = 'pbkdf2$';
export const PASSWORD_ITERATIONS = 100000;
const KEY_LENGTH = 32;

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotRight(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256Bytes(message: Uint8Array): Uint8Array {
  const bitLenHi = Math.floor(message.length / 0x20000000);
  const bitLenLo = (message.length * 8) >>> 0;
  const total = Math.ceil((message.length + 9) / 64) * 64;

  const padded = new Uint8Array(total);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(total - 8, bitLenHi, false);
  view.setUint32(total - 4, bitLenLo, false);

  const w = new Uint32Array(64);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);

  for (let blockStart = 0; blockStart < total; blockStart += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(blockStart + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotRight(w[t - 15], 7) ^ rotRight(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotRight(w[t - 2], 17) ^ rotRight(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];

    for (let t = 0; t < 64; t++) {
      const s1 = rotRight(e, 6) ^ rotRight(e, 11) ^ rotRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + K[t] + w[t]) >>> 0;
      const s0 = rotRight(a, 2) ^ rotRight(a, 13) ^ rotRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (h[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (h[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (h[i] >>> 8) & 0xff;
    out[i * 4 + 3] = h[i] & 0xff;
  }
  return out;
}

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const k = key.length > 64 ? sha256Bytes(key) : key;
  const block = new Uint8Array(64);
  block.set(k);

  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    ipad[i] = block[i] ^ 0x36;
    opad[i] = block[i] ^ 0x5c;
  }

  const inner = new Uint8Array(ipad.length + message.length);
  inner.set(ipad);
  inner.set(message, ipad.length);
  const innerHash = sha256Bytes(inner);

  const outer = new Uint8Array(opad.length + innerHash.length);
  outer.set(opad);
  outer.set(innerHash, opad.length);
  return sha256Bytes(outer);
}

export function pbkdf2Sha256(password: Uint8Array, salt: Uint8Array, iterations: number, dkLen: number): Uint8Array {
  const blockCount = Math.ceil(dkLen / 32);
  const derived = new Uint8Array(blockCount * 32);

  for (let i = 1; i <= blockCount; i++) {
    const block = new Uint8Array(salt.length + 4);
    block.set(salt);
    block[salt.length] = (i >>> 24) & 0xff;
    block[salt.length + 1] = (i >>> 16) & 0xff;
    block[salt.length + 2] = (i >>> 8) & 0xff;
    block[salt.length + 3] = i & 0xff;

    let u = hmacSha256(password, block);
    const t = new Uint8Array(u);
    for (let it = 1; it < iterations; it++) {
      u = hmacSha256(password, u);
      for (let j = 0; j < u.length; j++) t[j] ^= u[j];
    }
    derived.set(t, (i - 1) * 32);
  }

  return derived.length === dkLen ? derived : derived.slice(0, dkLen);
}

function utf8Encode(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    let code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code <= 0x7f) {
      bytes.push(code);
    } else if (code <= 0x7ff) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code <= 0xffff) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Hex inválido');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function isPbkdf2Hash(hash: string): boolean {
  return hash.startsWith(PASSWORD_PREFIX);
}

export function isLegacySha256Hash(hash: string): boolean {
  return !isPbkdf2Hash(hash);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const derived = pbkdf2Sha256(utf8Encode(password), utf8Encode(salt), PASSWORD_ITERATIONS, KEY_LENGTH);
  return `${PASSWORD_PREFIX}${PASSWORD_ITERATIONS}$${toHex(derived)}`;
}

export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;
  if (isPbkdf2Hash(storedHash)) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 1) return false;
    let stored: Uint8Array;
    try {
      stored = fromHex(parts[2]);
    } catch {
      return false;
    }
    if (stored.length !== KEY_LENGTH) return false;
    const derived = pbkdf2Sha256(utf8Encode(password), utf8Encode(salt), iterations, KEY_LENGTH);
    return constantTimeEqual(derived, stored);
  }
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}${password}`);
  return digest === storedHash;
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