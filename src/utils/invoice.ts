const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_LENGTH = 3;
const BASE = 26;
const BLOCK_SIZE = 9999;
const START_PREFIX = 'FAC';

export function prefixValue(letters: string): number {
  let value = 0;
  for (const char of letters) {
    value = value * BASE + char.charCodeAt(0) - ALPHABET.charCodeAt(0);
  }
  return value;
}

export function prefixLetters(value: number): string {
  let remaining = value;
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out = ALPHABET[remaining % BASE] + out;
    remaining = Math.floor(remaining / BASE);
  }
  return out;
}

export function invoiceCodeFor(orderNumber: number): string {
  const position = Math.max(0, orderNumber - 1);
  const combo = prefixValue(START_PREFIX) + Math.floor(position / BLOCK_SIZE);
  const digits = (position % BLOCK_SIZE) + 1;
  return `${prefixLetters(combo)}-${String(digits).padStart(4, '0')}`;
}