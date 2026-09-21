import { Platform } from 'react-native';
import { buildBackupBundle } from './backupService';
import { serializeBackup } from '../utils/backup';

const AUTO_DIR = 'vendelo/';
const PREFIX = 'respaldo-auto-';
const MAX_AUTO_BACKUPS = 5;

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
    const { documentDirectory, readDirectoryAsync, deleteAsync } = require('expo-file-system/legacy');
    if (!documentDirectory) return;
    const dir = documentDirectory + AUTO_DIR;
    const files: string[] = (await readDirectoryAsync(dir)).filter((f: string) => f.startsWith(PREFIX) && f.endsWith('.json'));
    files.sort();
    const toDelete = files.slice(0, Math.max(0, files.length - MAX_AUTO_BACKUPS));
    for (const file of toDelete) {
      await deleteAsync(dir + file, { idempotent: true });
    }
  } catch {
  }
}