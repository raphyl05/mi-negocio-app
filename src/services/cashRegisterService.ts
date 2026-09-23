import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CashRegister } from '../models/cashRegister';
import { generateId } from '../utils/password';
import { enqueueSyncChange } from './syncChangeQueue';
import { createLocalAutoBackup } from './autoBackupService';

const REGISTER_KEY = '@micaja/cashRegister';
const CLOSURES_KEY = '@micaja/cashClosures';

export type CashClosureRecord = {
  id: string;
  closedAt: string;
  openingAmountCents: number;
  expectedCashCents: number;
  countedCashCents: number;
  differenceCents: number;
  orderCount: number;
  salesCents: number;
  cashSalesCents: number;
  transferSalesCents: number;
};

export async function getOpenRegister(): Promise<CashRegister | null> {
  const raw = await AsyncStorage.getItem(REGISTER_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as CashRegister;
}

export async function openRegister(openingAmountCents: number): Promise<CashRegister> {
  const register: CashRegister = {
    id: generateId(),
    openingAmountCents,
    openedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(REGISTER_KEY, JSON.stringify(register));
  return register;
}

export async function listCashClosures(): Promise<CashClosureRecord[]> {
  const raw = await AsyncStorage.getItem(CLOSURES_KEY);
  return raw ? (JSON.parse(raw) as CashClosureRecord[]) : [];
}

export async function upsertCashClosureRecord(record: CashClosureRecord): Promise<CashClosureRecord> {
  const closures = await listCashClosures();
  const index = closures.findIndex((c) => c.id === record.id);
  if (index >= 0) closures[index] = record;
  else closures.push(record);
  await AsyncStorage.setItem(CLOSURES_KEY, JSON.stringify(closures));
  return record;
}

export async function closeRegister(closure: Omit<CashClosureRecord, 'id' | 'closedAt'>): Promise<CashClosureRecord> {
  const register = await getOpenRegister();
  if (!register) throw new Error('No hay caja abierta para cerrar.');
  const record: CashClosureRecord = {
    ...closure,
    id: generateId(),
    closedAt: new Date().toISOString(),
  };
  await upsertCashClosureRecord(record);
  await AsyncStorage.removeItem(REGISTER_KEY);
  await enqueueSyncChange('cashClosure', record.id, 'upsert');
  await createLocalAutoBackup();
  return record;
}