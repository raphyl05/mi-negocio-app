import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDriveStatus } from './driveService';
import { buildBackupBundle } from './backupService';
import { uploadBackup } from './driveService';
import { syncPushData, type SyncResult } from './syncService';
import { getBusiness } from './setupService';

const PENDING_KEY = '@micaja/pendingSync';

export type SyncPushResult = { ok: boolean; accepted: number; rejected: number };
export { type SyncResult } from './syncService';

async function getPending(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  return raw ? JSON.parse(raw) as string[] : [];
}

export async function queueSync(reason: string): Promise<void> {
  const pending = await getPending();
  pending.push(`${Date.now()}:${reason}`);
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export async function getPendingCount(): Promise<number> {
  return (await getPending()).length;
}

export async function clearPending(): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, '[]');
}

export async function processQueue(): Promise<{ synced: number; errors: string[] }> {
  const pending = await getPending();
  if (pending.length === 0) return { synced: 0, errors: [] };
  const errors: string[] = [];
  let synced = 0;
  for (const _ of pending) {
    try {
      const status = await getDriveStatus();
      if (!status.connected) break;
      const bundle = await buildBackupBundle();
      const result = await uploadBackup(bundle);
      if (result.ok) synced++;
      else { errors.push(result.message); break; }
      try {
        const business = await getBusiness();
        if (business?.id) {
          const pushRes = await syncPushData(business.id);
          if (pushRes.errors.length > 0) errors.push(`api-sync: ${pushRes.errors.join(', ')}`);
        }
      } catch { /* API sync optional */ }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Error');
      break;
    }
  }
  if (errors.length === 0) {
    await clearPending();
  } else {
    const remaining = pending.slice(synced);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
  }
  return { synced, errors };
}
