jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  closeRegister,
  getOpenRegister,
  listCashClosures,
  openRegister,
} from '../src/services/cashRegisterService';

const zeroClosure = {
  openingAmountCents: 10000,
  expectedCashCents: 35000,
  countedCashCents: 35500,
  differenceCents: -500,
  orderCount: 0,
  salesCents: 0,
  cashSalesCents: 0,
  transferSalesCents: 0,
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('cashRegisterService', () => {
  it('abre la caja y la lee', async () => {
    const reg = await openRegister(10000);
    expect(reg.openingAmountCents).toBe(10000);
    expect(await getOpenRegister()).toEqual(reg);
  });

  it('cierra la caja guardando el desglose completo del turno', async () => {
    await openRegister(10000);
    const record = await closeRegister({
      ...zeroClosure,
      orderCount: 4,
      salesCents: 100000,
      cashSalesCents: 25000,
      transferSalesCents: 75000,
    });

    expect(record.orderCount).toBe(4);
    expect(record.salesCents).toBe(100000);
    expect(record.cashSalesCents).toBe(25000);
    expect(record.transferSalesCents).toBe(75000);
    expect(record.differenceCents).toBe(-500);
    expect(await getOpenRegister()).toBeNull();

    const closures = await listCashClosures();
    expect(closures).toHaveLength(1);
    expect(closures[0].id).toBe(record.id);
  });

  it('rechaza cerrar sin caja abierta y no crea registros fantasma', async () => {
    await expect(closeRegister(zeroClosure)).rejects.toThrow('No hay caja abierta');
    expect(await listCashClosures()).toHaveLength(0);
  });

  it('no permite cerrar dos veces seguidas', async () => {
    await openRegister(10000);
    await closeRegister(zeroClosure);
    expect(await listCashClosures()).toHaveLength(1);

    await expect(closeRegister(zeroClosure)).rejects.toThrow('No hay caja abierta');
    expect(await listCashClosures()).toHaveLength(1);
  });
});