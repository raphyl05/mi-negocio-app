import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Business } from '../models/business';
import type { SessionUser, User } from '../models/user';
import { generateId, generateSalt, hashPassword, isLegacySha256Hash, verifyPassword } from '../utils/password';
import { readSecureUser, removeSecureUser, writeSecureUser } from '../utils/secureStore';

const BUSINESS_KEY = '@micaja/business';

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
  const withIdentity: Business = business.id ? business : { ...business, id: generateId() };
  await AsyncStorage.setItem(BUSINESS_KEY, JSON.stringify(withIdentity));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([BUSINESS_KEY]);
  await removeSecureUser();
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
  await writeSecureUser(JSON.stringify(user));
}

export async function hasSecurityQuestion(): Promise<boolean> {
  const user = await getUser();
  return Boolean(user?.securityQuestion && user?.securityAnswerHash && user?.securityAnswerSalt);
}

export async function verifySecurityAnswer(username: string, answer: string): Promise<boolean> {
  const user = await getUser();
  if (!user || !user.securityAnswerHash || !user.securityAnswerSalt) return false;
  if (user.username.trim().toLocaleLowerCase() !== username.trim().toLocaleLowerCase()) return false;
  const normalized = normalizeSecurityAnswer(answer);
  const ok = await verifyPassword(normalized, user.securityAnswerSalt, user.securityAnswerHash);
  if (!ok) return false;
  if (isLegacySha256Hash(user.securityAnswerHash)) {
    const securityAnswerSalt = await generateSalt();
    const securityAnswerHash = await hashPassword(normalized, securityAnswerSalt);
    await updateUser({ ...user, securityAnswerHash, securityAnswerSalt });
  }
  return true;
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
  const raw = await readSecureUser();
  if (!raw) return null;
  return JSON.parse(raw) as User;
}

export async function verifyLogin(username: string, password: string): Promise<SessionUser | null> {
  const user = await getUser();
  if (!user) return null;
  if (!user.passwordHash || !user.passwordSalt) return null;

  if (user.username.trim().toLowerCase() !== username.trim().toLowerCase()) {
    return null;
  }

  const ok = await verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!ok) return null;

  if (isLegacySha256Hash(user.passwordHash)) {
    const salt = await generateSalt();
    const passwordHash = await hashPassword(password, salt);
    await updateUser({ ...user, passwordHash, passwordSalt: salt });
  }

  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

export async function saveSetup({ name, ownerName, phone, address, username, password }: SetupPayload): Promise<void> {
  const salt = await generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const business: Business = {
    id: generateId(),
    name: name.trim(),
    ownerName: ownerName?.trim() || undefined,
    phone: phone?.trim() || undefined,
    address: address?.trim() || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const user: User = {
    id: generateId(),
    username: username.trim(),
    passwordHash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  };

  await AsyncStorage.multiSet([[BUSINESS_KEY, JSON.stringify(business)]]);
  await writeSecureUser(JSON.stringify(user));
}