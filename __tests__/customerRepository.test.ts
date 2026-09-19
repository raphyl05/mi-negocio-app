import type { Customer } from '../src/models/customer';
import { createInMemoryCustomerRepository } from '../src/repositories/customerRepository';

const base: Omit<Customer, 'id'> = {
  name: 'Juan Pérez',
  phone: '809-555-1234',
  address: 'Calle 1 #23',
  note: 'Clienta frecuente',
  createdAt: '2026-09-18T08:00:00.000Z',
};

describe('createInMemoryCustomerRepository', () => {
  it('crea un cliente asignando id', async () => {
    const repo = createInMemoryCustomerRepository();
    const created = await repo.create(base);
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Juan Pérez');
  });

  it('lista en memoria respeta el orden de inserción', async () => {
    const inMemory = createInMemoryCustomerRepository();
    await inMemory.create({ ...base, name: 'Zeta' });
    await inMemory.create({ ...base, name: 'Alfa' });
    const list = await inMemory.list();
    expect(list[0].name).toBe('Zeta');
  });

  it('actualiza un cliente existente', async () => {
    const repo = createInMemoryCustomerRepository();
    const created = await repo.create(base);
    const updated = await repo.update({ ...created, phone: '809-000-0000' });
    expect(updated.phone).toBe('809-000-0000');
    const fetched = await repo.getById(created.id);
    expect(fetched?.phone).toBe('809-000-0000');
  });

  it('elimina un cliente', async () => {
    const repo = createInMemoryCustomerRepository();
    const created = await repo.create(base);
    await repo.remove(created.id);
    expect(await repo.getById(created.id)).toBeNull();
    expect(await repo.list()).toEqual([]);
  });

  it('actualizar un id inexistente queda sin efecto', async () => {
    const repo = createInMemoryCustomerRepository();
    const updated = await repo.update({ ...base, id: 'no-existe' });
    expect(updated.id).toBe('no-existe');
    expect(await repo.list()).toEqual([]);
  });
});