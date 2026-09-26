import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PrinterConfig } from './types';

const KEY = '@vendelo/printer';

export async function loadPrinterConfig(): Promise<PrinterConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PrinterConfig;
  } catch {
    return null;
  }
}

export async function savePrinterConfig(config: PrinterConfig): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    // Persistencia opcional: si falla, la sesión sigue funcionando en memoria.
  }
}

export async function mergePrinterConfig(partial: Partial<PrinterConfig>): Promise<PrinterConfig> {
  const current = (await loadPrinterConfig()) ?? { enabled: false };
  const next: PrinterConfig = { ...current, ...partial };
  await savePrinterConfig(next);
  return next;
}