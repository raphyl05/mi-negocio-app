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

export async function saveBusiness(business: Business): Promise<void> {
  await AsyncStorage.setItem(BUSINESS_KEY, JSON.stringify(business));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([BUSINESS_KEY, USER_KEY]);
}

export function normalizeSecurityAnswer(answer: string): string {
  return answer.trim().toLocaleLowerCase();
}

export async function saveSecurityQuestion(question: string, answer: string): Promise<boolean> {
  const user = await getUser();
  if (!user || !question.trim()) return false;
  const answerSalt = await generateSalt();
  const answerHash = await hashPassword(normalizeSecurityAnswer(answer), answerSalt);
  await updateUser({
    ...user,
    securityQuestion: question.trim(),
    securityAnswerHash: answerHash,
    securityAnswerSalt: answerSalt,
  });
  return true;
}

export async function updateUser(user: User): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function hasSecurityQuestion(): Promise<boolean> {
  const user = await getUser();
  return Boolean(user?.securityQuestion && user?.securityAnswerHash && user?.securityAnswerSalt);
}

export async function verifySecurityAnswer(username: string, answer: string): Promise<boolean> {
  const user = await getUser();
  if (!user || !user.securityAnswerHash || !user.securityAnswerSalt) return false;
  if (user.username.trim().toLocaleLowerCase() !== username.trim().toLocaleLowerCase()) return false;
  const hash = await hashPassword(normalizeSecurityAnswer(answer), user.securityAnswerSalt);
  return hash === user.securityAnswerHash;
}

export async function setNewPassword(username: string, newPassword: string): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  if (user.username.trim().toLocaleLowerCase() !== username.trim().toLocaleLowerCase()) return false;
  const salt = await generateSalt();
  const passwordHash = await hashPassword(newPassword, salt);
  await updateUser({ ...user, passwordHash, passwordSalt: salt });
  return true;
}

export async function getUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as User;
}

export async function verifyLogin(username: string, password: string): Promise<User | null> {
  const user = await getUser();
  if (!user) return null;

  if (user.username.trim().toLowerCase() !== username.trim().toLowerCase()) {
    return null;
  }

  const hash = await hashPassword(password, user.passwordSalt);
  if (hash !== user.passwordHash) {
    return null;
  }

  return user;
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