// Codifica bytes a Base64 sin dependencias (la librería BLE espera base64).
const TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: ArrayLike<number>): string {
  let result = '';
  const length = bytes.length;
  for (let i = 0; i < length; i += 3) {
    const b0 = bytes[i] & 0xff;
    const b1 = i + 1 < length ? bytes[i + 1] & 0xff : 0;
    const b2 = i + 2 < length ? bytes[i + 2] & 0xff : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    result +=
      TABLE[(triple >> 18) & 0x3f] +
      TABLE[(triple >> 12) & 0x3f] +
      (i + 1 < length ? TABLE[(triple >> 6) & 0x3f] : '=') +
      (i + 2 < length ? TABLE[triple & 0x3f] : '=');
  }
  return result;
}

// Divide bytes en fragmentos para no exceder el tamaño de escritura BLE.
export function chunkBytes(bytes: Uint8Array, size: number): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    chunks.push(bytes.subarray(offset, offset + size));
  }
  return chunks;
}