import AsyncStorage from '@react-native-async-storage/async-storage';

export type SyncEntityType =
  | 'business'
  | 'product'
  | 'customer'
  | 'provider'
  | 'order'
  | 'stockMovement'
  | 'cashClosure';

export type SyncAction = 'upsert' | 'delete';

export type SyncChange = {
  key: string;
  entityType: SyncEntityType;
  entityId: string;
  action: SyncAction;
  at: string;
};

const CHANGES_KEY = '@micaja/syncChanges';
let trackingEnabled = true;

export function setSyncTrackingEnabled(enabled: boolean): void {
  trackingEnabled = enabled;
}

export function isSyncTrackingEnabled(): boolean {
  return trackingEnabled;
}

async function readMap(): Promise<Record<string, SyncChange>> {
  try {
    const raw = await AsyncStorage.getItem(CHANGES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, SyncChange>) : {};
  } catch {
    return {};
  }
}

async function writeMap(map: Record<string, SyncChange>): Promise<void> {
  await AsyncStorage.setItem(CHANGES_KEY, JSON.stringify(map));
}

export async function enqueueSyncChange(
  entityType: SyncEntityType,
  entityId: string,
  action: SyncAction = 'upsert',
): Promise<void> {
  if (!trackingEnabled) return;
  const trimmedId = (entityId ?? '').trim();
  if (!trimmedId) return;

  const key = `${entityType}:${trimmedId}`;
  const map = await readMap();
  const prev = map[key];

  if (prev && prev.action === 'delete' && action === 'upsert') {
    return;
  }

  map[key] = { key, entityType, entityId: trimmedId, action, at: new Date().toISOString() };
  await writeMap(map);
}

export async function listSyncChanges(): Promise<SyncChange[]> {
  const map = await readMap();
  return Object.values(map).sort((a, b) => a.at.localeCompare(b.at));
}

export async function countSyncChanges(): Promise<number> {
  return (await listSyncChanges()).length;
}

export async function dequeueSyncChanges(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const map = await readMap();
  for (const k of keys) delete map[k];
  await writeMap(map);
}

export async function clearSyncChanges(): Promise<void> {
  await AsyncStorage.setItem(CHANGES_KEY, '{}');
}