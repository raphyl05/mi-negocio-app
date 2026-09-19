import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import type { Business } from '../models/business';
import type { CashRegister } from '../models/cashRegister';
import type { CashClosureRecord } from '../services/cashRegisterService';
import type { Customer } from '../models/customer';
import type { Order } from '../models/order';
import type { Product } from '../models/product';
import type { Provider } from '../models/provider';
import type { User } from '../models/user';
import type { PrinterConfig } from './printer/types';
import { getBusiness, getUser, saveBusiness, updateUser } from './setupService';
import { savePrinterConfig, loadPrinterConfig } from './printer/printerConfigStore';
import { productRepository, resetProductRepository } from '../repositories/productRepository';
import { orderRepository, resetOrderRepository } from '../repositories/orderRepository';
import { customerRepository, resetCustomerRepository } from '../repositories/customerRepository';
import { providerRepository, resetProviderRepository } from '../repositories/providerRepository';
import { parseBackup, serializeBackup, type BackupBundle } from '../utils/backup';

const KEYS = ['@micaja/business', '@micaja/user', '@micaja/cashRegister', '@micaja/cashClosures', '@micaja/printer'];

async function clearAppStorage(): Promise<void> {
  await AsyncStorage.multiRemove(KEYS);
}

async function deleteDatabaseFileNative(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    // Lazy-require para que expo-sqlite no se cargue en tests ni web.
    const { deleteDatabaseFile } = require('../repositories/database.native');
    await deleteDatabaseFile();
  } catch {
    // Si falla, los repositorios en memoria se resetean igualmente.
  }
}

function resetAllRepositories(): void {
  resetProductRepository();
  resetOrderRepository();
  resetCustomerRepository();
  resetProviderRepository();
}

export async function buildBackupBundle(): Promise<BackupBundle> {
  const [business, user, register, closures, printer] = await Promise.all([
    getBusiness(),
    getUser(),
    AsyncStorage.getItem('@micaja/cashRegister'),
    AsyncStorage.getItem('@micaja/cashClosures'),
    loadPrinterConfig(),
  ]);
  return {
    app: 'vendelo',
    version: 1,
    exportedAt: new Date().toISOString(),
    business,
    user,
    cashRegister: register ? (JSON.parse(register) as CashRegister) : null,
    cashClosures: closures ? (JSON.parse(closures) as CashClosureRecord[]) : null,
    printer,
    products: await productRepository.list(),
    orders: [...(await orderRepository.listPending()), ...(await orderRepository.listPaid())],
    customers: await customerRepository.list(),
    providers: await providerRepository.list(),
  };
}

export async function exportBackupToShare(): Promise<void> {
  try {
    const bundle = await buildBackupBundle();
    const json = serializeBackup(bundle);
    const { writeAsStringAsync, getInfoAsync, cacheDirectory } = require('expo-file-system/legacy');
    const { shareAsync } = require('expo-sharing');
    const fileName = `vendelo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const uri = cacheDirectory ? `${cacheDirectory}${fileName}` : fileName;
    await writeAsStringAsync(uri, json, { encoding: 'utf8' });
    const info = await getInfoAsync(uri);
    if (!info.exists) throw new Error('No se pudo escribir el archivo.');
    try {
      await shareAsync(uri, {
        mimeType: 'application/json',
        subject: 'Respaldo de Vendelo App',
        message: 'Respaldo de Vendelo App — restaurar desde la opción "Restaurar respaldo".',
      });
    } catch {
      Alert.alert('Respaldo listo', `Archivo generado en:\n${uri}\nCompártelo desde tu explorador o gestor de archivos.`);
    }
  } catch (err) {
    Alert.alert('Error al exportar', err instanceof Error ? err.message : 'No se pudo generar el respaldo.');
  }
}

export async function restoreBackupFromFile(): Promise<void> {
  try {
    const { getDocumentAsync } = require('expo-document-picker');
    const { readAsStringAsync } = require('expo-file-system/legacy');
    const { DocumentPickerCancel } = require('expo-document-picker');
    const result = await getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.type === 'cancel') return;
    const raw = await readAsStringAsync(result.assets[0].uri);
    const parsed = parseBackup(raw);
    if (!parsed.ok) {
      Alert.alert('Respaldo no válido', parsed.message);
      return;
    }
    Alert.alert('Confirmar restauración', 'Esto reemplazará los datos actuales del negocio. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Restaurar',
        style: 'destructive',
        onPress: () => applyRestoredBundle(parsed.bundle),
      },
    ]);
  } catch (err) {
    if ((err as { name?: string })?.name === 'DocumentPickerCancel') return;
    Alert.alert('Error al importar', err instanceof Error ? err.message : 'No se pudo leer el archivo.');
  }
}

export async function applyRestoredBundle(bundle: BackupBundle): Promise<void> {
  try {
    await clearAppStorage();
    await deleteDatabaseFileNative();
    resetAllRepositories();

    const pairs: [string, string][] = [
      ['@micaja/business', JSON.stringify(bundle.business ?? {})],
      ['@micaja/user', JSON.stringify(bundle.user ?? {})],
      ['@micaja/cashRegister', JSON.stringify(bundle.cashRegister ?? {})],
      ['@micaja/cashClosures', JSON.stringify(bundle.cashClosures ?? [])],
      ['@micaja/printer', JSON.stringify(bundle.printer ?? {})],
    ];
    const toSave = pairs.filter(([, v]) => v !== '{}' && v !== '[]');
    await AsyncStorage.multiSet(toSave);
    await savePrinterConfig(bundle.printer ?? { enabled: false });
    if (bundle.business) await saveBusiness(bundle.business);
    if (bundle.user) await updateUser(bundle.user);

    await restoreRepo(productRepository, bundle.products);
    await restoreRepo(customerRepository, bundle.customers);
    await restoreRepo(providerRepository, bundle.providers);
    await restoreOrders(orderRepository, bundle.orders);

    Alert.alert('Restauración completa', 'Los datos del respaldo se cargaron correctamente.');
  } catch (err) {
    Alert.alert('Error al restaurar', err instanceof Error ? err.message : 'No se pudo restaurar el respaldo.');
  }
}

async function restoreRepo<T>(repo: { list(): Promise<T[]>; create(item: T): Promise<T>; remove(id: string): Promise<void> }, items: T[]): Promise<void> {
  const existing = await repo.list();
  for (const item of existing) await repo.remove((item as { id: string }).id);
  for (const item of items) await repo.create(item);
}

async function restoreOrders(repo: { listPending(): Promise<Order[]>; listPaid(): Promise<Order[]>; remove(id: string): Promise<void>; save(order: Order): Promise<Order> }, orders: Order[]): Promise<void> {
  const pending = await repo.listPending();
  for (const o of pending) await repo.remove(o.id);
  const paid = await repo.listPaid();
  for (const o of paid) await repo.remove(o.id);
  for (const o of [...orders].sort((a, b) => a.number - b.number)) await repo.save(o);
}

export async function deleteAccountAndData(): Promise<void> {
  await clearAppStorage();
  await deleteDatabaseFileNative();
  resetAllRepositories();
}
