import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CashRegister } from '../models/cashRegister';
import { generateId } from '../utils/password';

const REGISTER_KEY = '@micaja/cashRegister';

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