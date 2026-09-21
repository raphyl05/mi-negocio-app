import { getDatabase } from './database.native';

export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const db = await getDatabase();
  let result!: T;
  await db.withTransactionAsync(async () => {
    result = await fn();
  });
  return result;
}