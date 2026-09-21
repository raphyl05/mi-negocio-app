import {
  hashPassword,
  isPbkdf2Hash,
  pbkdf2Sha256,
  sha256Bytes,
  verifyPassword,
} from '../src/utils/password';

const FIXED_SALT = '00000000000000000000000000000000';

function utf8(value: string): Uint8Array {
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
    if (code <= 0x7f) bytes.push(code);
    else if (code <= 0x7ff) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code <= 0xffff) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return new Uint8Array(bytes);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('sha256 (implementación pura JS)', () => {
  it('coincide con el vector NIST de "abc"', () => {
    expect(hex(sha256Bytes(utf8('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('coincide con el vector de cadena vacía', () => {
    expect(hex(sha256Bytes(utf8('')))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('pbkdf2Sha256 (HMAC-SHA256)', () => {
  it('vector 1 iteración: password/salt', () => {
    expect(hex(pbkdf2Sha256(utf8('password'), utf8('salt'), 1, 32))).toBe(
      '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b',
    );
  });

  it('vector 4096 iteraciones con 32 bytes de salida', () => {
    expect(hex(pbkdf2Sha256(utf8('password'), utf8('salt'), 4096, 32))).toBe(
      'c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a',
    );
  });

  it('produce salida estable a longitud 32', () => {
    expect(hex(pbkdf2Sha256(utf8('clave'), utf8('sal'), 10, 32)).length).toBe(64);
  });
});

describe('hashPassword / verifyPassword', () => {
  const hashPromise = hashPassword('clave1234', FIXED_SALT);

  it('genera el formato pbkdf2$iter$hex con iteraciones altas', async () => {
    const hash = await hashPromise;
    expect(hash.startsWith('pbkdf2$')).toBe(true);
    const parts = hash.split('$');
    expect(parts.length).toBe(3);
    expect(Number(parts[1])).toBeGreaterThanOrEqual(100000);
    expect(parts[2]).toMatch(/^[0-9a-f]{64}$/);
    expect(isPbkdf2Hash(hash)).toBe(true);
  });

  it('es determinista con la misma sal y distinto con sal distinta', async () => {
    const hash = await hashPromise;
    const again = await hashPassword('clave1234', FIXED_SALT);
    const other = await hashPassword('clave1234', '11111111111111111111111111111111');
    expect(again).toBe(hash);
    expect(other).not.toBe(hash);
  });

  it('verifica contraseñas correctas e incorrectas', async () => {
    const hash = await hashPromise;
    expect(await verifyPassword('clave1234', FIXED_SALT, hash)).toBe(true);
    expect(await verifyPassword('otra', FIXED_SALT, hash)).toBe(false);
    expect(await verifyPassword('clave1234', '11111111111111111111111111111111', hash)).toBe(false);
  });

  it('rechaza hashes pbkdf2 corruptos y vacíos', async () => {
    expect(await verifyPassword('x', FIXED_SALT, 'pbkdf2$100000$zz')).toBe(false);
    expect(await verifyPassword('x', FIXED_SALT, 'pbkdf2$abc$x'.padEnd(64, '0'))).toBe(false);
    expect(await verifyPassword('x', FIXED_SALT, '')).toBe(false);
  });
});