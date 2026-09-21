export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}