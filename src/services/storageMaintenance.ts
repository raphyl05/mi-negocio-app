import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { productRepository } from '../repositories/productRepository';
import { planCacheCleanup } from '../utils/backupPrune';

const LAST_VACUUM_KEY = '@vendelo/lastVacuumAt';

const VACUUM_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MOVEMENTS_RETENTION_DAYS = 180;

export type StorageReport = {
  databaseBytes: number;
  walBytes: number;
  cacheBytes: number;
  backupsBytes: number;
  backupCount: number;
};

function isWeb(): boolean {
  return Platform.OS === 'web';
}

export function bytesToMb(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
}

export function formatBytes(bytes: number): string {
  return bytesToMb(bytes);
}

async function getPathInfo(uri: string | null): Promise<{ exists: boolean; size: number }> {
  if (!uri) return { exists: false, size: 0 };
  try {
    const { getInfoAsync } = require('expo-file-system/legacy');
    const info = await getInfoAsync(uri);
    return { exists: !!info.exists, size: info.exists ? (info.size ?? 0) : 0 };
  } catch {
    return { exists: false, size: 0 };
  }
}

function directorySize(entries: Array<{ name: string; size: number }>): number {
  return entries.reduce((sum, entry) => sum + (entry.size ?? 0), 0);
}

async function isVacuumDue(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LAST_VACUUM_KEY);
    if (!raw) return true;
    const last = new Date(raw).getTime();
    return Date.now() - last >= VACUUM_MIN_INTERVAL_MS;
  } catch {
    return false;
  }
}

async function markVacuumDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_VACUUM_KEY, new Date().toISOString());
  } catch {
    // Best effort: un fallo aquí solo hace que el VACUUM vuelva a intentarse antes.
  }
}

async function vacuumIfDue(): Promise<boolean> {
  if (!(await isVacuumDue())) return false;
  try {
    const { vacuumDatabase } = require('../repositories/database.native');
    await vacuumDatabase();
    await markVacuumDone();
    return true;
  } catch {
    return false;
  }
}

async function checkpointNow(): Promise<void> {
  try {
    const { checkpointDatabase } = require('../repositories/database.native');
    await checkpointDatabase();
  } catch {
    // Mejor esfuerzo.
  }
}

async function pruneSyncedMovements(): Promise<void> {
  try {
    const { pruneSyncedStockMovements } = require('../repositories/database.native');
    await pruneSyncedStockMovements(MOVEMENTS_RETENTION_DAYS);
  } catch {
    // Mejor esfuerzo.
  }
}

// Conserva solo la cuarentena pre-restauración más reciente y borra los exportes
// de respaldo que ya fueron compartidos. Todo en best-effort.
async function pruneCacheBackups(): Promise<void> {
  try {
    const { cacheDirectory, readDirectoryAsync, deleteAsync } = require('expo-file-system/legacy');
    if (!cacheDirectory) return;
    const files: string[] = await readDirectoryAsync(cacheDirectory);
    const toDelete = planCacheCleanup(files);
    for (const file of toDelete) {
      await deleteAsync(cacheDirectory + file, { idempotent: true });
    }
  } catch {
    // Mejor esfuerzo.
  }
}

// Borra las fotos de la galería en caché (carpeta ImagePicker) que ningún
// producto referencia. Solo se ejecuta al arrancar, nunca con el formulario abierto.
async function pruneOrphanProductPhotos(): Promise<void> {
  try {
    const { cacheDirectory, readDirectoryAsync, deleteAsync } = require('expo-file-system/legacy');
    if (!cacheDirectory) return;
    const photoDir = cacheDirectory + 'ImagePicker/';
    let files: string[];
    try {
      files = await readDirectoryAsync(photoDir);
    } catch {
      return;
    }
    if (files.length === 0) return;
    const all = await productRepository.list();
    const referenced = new Set(
      all.map((product) => product.imageUri ?? '').filter((uri) => uri && uri.startsWith(photoDir)),
    );
    for (const file of files) {
      const uri = photoDir + file;
      if (!referenced.has(uri)) {
        await deleteAsync(uri, { idempotent: true });
      }
    }
  } catch {
    // Mejor esfuerzo.
  }
}

// Lo corre el arranque de la app, sin bloquear la UI.
export async function runStartupStorageMaintenance(): Promise<void> {
  if (isWeb()) return;
  const tasks: Promise<unknown>[] = [
    pruneCacheBackups(),
    pruneSyncedMovements(),
    vacuumIfDue(),
    checkpointNow(),
  ];
  await Promise.allSettled(tasks);
}

export function initStorageMaintenance(): void {
  if (isWeb()) return;
  AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'background' || next === 'inactive') {
      checkpointNow();
    }
  });
}

export async function reportStorage(): Promise<StorageReport> {
  const empty: StorageReport = { databaseBytes: 0, walBytes: 0, cacheBytes: 0, backupsBytes: 0, backupCount: 0 };
  if (isWeb()) return empty;

  try {
    const { documentDirectory, cacheDirectory, readDirectoryAsync, getInfoAsync } = require('expo-file-system/legacy');

    const dbPath = `${documentDirectory}SQLite/vendelo.db`;
    const walPath = `${documentDirectory}SQLite/vendelo.db-wal`;
    const shmPath = `${documentDirectory}SQLite/vendelo.db-shm`;

    const [dbInfo, walInfo, shmInfo] = await Promise.all([
      getPathInfo(dbPath),
      getPathInfo(walPath),
      getPathInfo(shmPath),
    ]);

    let cacheBytes = 0;
    let backupsBytes = 0;
    let backupCount = 0;
    try {
      const cacheFiles: string[] = await readDirectoryAsync(cacheDirectory ?? '');
      const cacheSizes = await Promise.all(
        cacheFiles.map(async (f) => {
          const info = await getInfoAsync((cacheDirectory ?? '') + f);
          const size = info.exists ? (info.size ?? 0) : 0;
          return { name: f, size };
        }),
      );
      cacheBytes = directorySize(cacheSizes);
    } catch {
      // Best effort.
    }
    try {
      const backupDir = `${documentDirectory}vendelo/`;
      const { getInfoAsync: dirInfo } = require('expo-file-system/legacy');
      const dirCheck = await dirInfo(backupDir);
      if (dirCheck.exists) {
        const backupFiles: string[] = await readDirectoryAsync(backupDir);
        backupCount = backupFiles.length;
        const backupSizes = await Promise.all(
          backupFiles.map(async (f) => {
            const info = await getInfoAsync(backupDir + f);
            return info.exists ? (info.size ?? 0) : 0;
          }),
        );
        backupsBytes = backupSizes.reduce((a, b) => a + b, 0);
      }
    } catch {
      // Best effort.
    }

    return {
      databaseBytes: dbInfo.size,
      walBytes: walInfo.size + shmInfo.size,
      cacheBytes,
      backupsBytes,
      backupCount,
    };
  } catch {
    return empty;
  }
}