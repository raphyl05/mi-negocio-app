import { bytesToBase64, chunkBytes } from '../src/utils/base64';

describe('bytesToBase64', () => {
  test('vector conocido: ESC @ => G0A=', () => {
    expect(bytesToBase64([0x1b, 0x40])).toBe('G0A=');
  });

  test('vacio => cadena vacia', () => {
    expect(bytesToBase64([])).toBe('');
  });

  test('3 bytes exactos sin padding', () => {
    expect(bytesToBase64([0xff, 0xff, 0xff])).toBe('////');
  });

  test('texto ascii', () => {
    expect(bytesToBase64([72, 105])) // "Hi"
      .toBe('SGk=');
  });
});

describe('chunkBytes', () => {
  test('divide en fragmentos del tamaño pedido', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
    const chunks = chunkBytes(bytes, 3);
    expect(chunks.map((c) => Array.from(c))).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ]);
  });

  test('tamaño mayor al contenido => un solo fragmento', () => {
    const chunks = chunkBytes(new Uint8Array([1, 2]), 512);
    expect(chunks).toHaveLength(1);
  });
});