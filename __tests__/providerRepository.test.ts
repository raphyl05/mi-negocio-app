import type { Provider } from '../src/models/provider';
import { createInMemoryProviderRepository } from '../src/repositories/providerRepository';

const base: Omit<Provider, 'id'> = {
  name: 'Distribuidora López',
  phone: '809-555-1234',
  address: 'Av. Principal #12',
  note: 'Despacha cada lunes',
  createdAt: '2026-09-18T08:00:00.000Z',
};

describe('createInMemoryProviderRepository', () => {
  it('crea un proveedor asignando id', async () => {
    const repo = createInMemoryProviderRepository();
    const created = await repo.create(base);
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Distribuidora López');
  });

  it('lista en memoria respeta el orden de inserción', async () => {
    const inMemory = createInMemoryProviderRepository();
    await inMemory.create({ ...base, name: 'Zeta' });
    await inMemory.create({ ...base, name: 'Alfa' });
    const list = await inMemory.list();
    expect(list[0].name).toBe('Zeta');
  });

  it('actualiza un proveedor existente', async () => {
    const repo = createInMemoryProviderRepository();
    const created = await repo.create(base);
    const updated = await repo.update({ ...created, phone: '809-000-0000' });
    expect(updated.phone).toBe('809-000-0000');
    const fetched = await repo.getById(created.id);
    expect(fetched?.phone).toBe('809-000-0000');
  });

  it('elimina un proveedor', async () => {
    const repo = createInMemoryProviderRepository();
    const created = await repo.create(base);
    await repo.remove(created.id);
    expect(await repo.getById(created.id)).toBeNull();
    expect(await repo.list()).toEqual([]);
  });

  it('actualizar un id inexistente queda sin efecto', async () => {
    const repo = createInMemoryProviderRepository();
    const updated = await repo.update({ ...base, id: 'no-existe' });
    expect(updated.id).toBe('no-existe');
    expect(await repo.list()).toEqual([]);
  });
});