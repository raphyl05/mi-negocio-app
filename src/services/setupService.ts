import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Business } from '../models/business';
import type { User } from '../models/user';
import { generateId, generateSalt, hashPassword } from '../utils/password';

const BUSINESS_KEY = '@micaja/business';
const USER_KEY = '@micaja/user';

export type SetupPayload = {
  name: string;
  ownerName?: string;
  phone?: string;
  address?: string;
  username: string;
  password: string;
};

export async function isSetupDone(): Promise<boolean> {
  const business = await AsyncStorage.getItem(BUSINESS_KEY);
  return business !== null;
}

export async function getBusiness(): Promise<Business | null> {
  const raw = await AsyncStorage.getItem(BUSINESS_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as Business;
}

export async function getUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as User;
}

export async function saveSetup({ name, ownerName, phone, address, username, password }: SetupPayload): Promise<void> {
  const salt = await generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const business: Business = {
    name: name.trim(),
    ownerName: ownerName?.trim() || undefined,
    phone: phone?.trim() || undefined,
    address: address?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const user: User = {
    id: generateId(),
    username: username.trim(),
    passwordHash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  };

  await AsyncStorage.multiSet([
    [BUSINESS_KEY, JSON.stringify(business)],
    [USER_KEY, JSON.stringify(user)],
  ]);
}