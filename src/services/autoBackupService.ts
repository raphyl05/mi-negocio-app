import { Platform } from 'react-native';
import { buildBackupBundle } from './backupService';
import { serializeBackup } from '../utils/backup';
import { planBackupPrune } from '../utils/backupPrune';

const AUTO_DIR = 'vendelo/';
const PREFIX = 'respaldo-auto-';
const MAX_AUTO_BACKUPS = 5;
const MAX_AUTO_BACKUP_TOTAL_BYTES = 25 * 1024 * 1024;

export async function createLocalAutoBackup(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { documentDirectory, getInfoAsync, makeDirectoryAsync, writeAsStringAsync } =
      require('expo-file-system/legacy');
    if (!documentDirectory) return;
    const dir = documentDirectory + AUTO_DIR;
    const info = await getInfoAsync(dir);
    if (!info.exists) await makeDirectoryAsync(dir, { intermediates: true });
    const bundle = await buildBackupBundle();
    const json = serializeBackup(bundle);
    const fileName = `${PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await writeAsStringAsync(dir + fileName, json, { encoding: 'utf8' });
    await pruneAutoBackups();
  } catch {
  }
}

async function pruneAutoBackups(): Promise<void> {
  try {
    const { documentDirectory, readDirectoryAsync, deleteAsync, getInfoAsync } = require('expo-file-system/legacy');
    if (!documentDirectory) return;
    const dir = documentDirectory + AUTO_DIR;
    const files: string[] = (await readDirectoryAsync(dir)).filter((f: string) => f.startsWith(PREFIX) && f.endsWith('.json'));
    const sizes = new Map<string, number>();
    for (const file of files) {
      const info = await getInfoAsync(dir + file);
      sizes.set(file, info.exists ? (info.size ?? 0) : 0);
    }
    const toDelete = planBackupPrune(files, MAX_AUTO_BACKUPS, MAX_AUTO_BACKUP_TOTAL_BYTES, (f) => sizes.get(f) ?? 0);
    for (const file of toDelete) {
      await deleteAsync(dir + file, { idempotent: true });
    }
  } catch {
  }
}