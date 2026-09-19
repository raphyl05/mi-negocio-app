import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { bytesToBase64, chunkBytes } from '../../../utils/base64';
import type { BlePrinterBridge, BlePrinterDevice } from './bleBridge';

const WRITE_CHUNK_SIZE = 512;
const SCAN_TIMEOUT_MS = 3500;
const CONNECT_TIMEOUT_MS = 15000;

type CharacteristicInfo = {
  uuid: string;
  serviceUUID: string;
  isWritableWithResponse: boolean;
  isWritableWithoutResponse: boolean;
};

type ServiceInfo = {
  uuid: string;
  characteristics(): Promise<CharacteristicInfo[]>;
};

type BleDevice = {
  id: string;
  name: string | null;
  localName: string | null;
  discoverAllServicesAndCharacteristics(): Promise<BleDevice>;
  services(): Promise<ServiceInfo[]>;
  writeCharacteristicWithResponseForService(service: string, characteristic: string, value: string): Promise<unknown>;
  writeCharacteristicWithoutResponseForService(service: string, characteristic: string, value: string): Promise<unknown>;
  isConnected(): Promise<boolean>;
};

type BleManagerLike = {
  startDeviceScan(
    uuids: string[] | null,
    options: unknown | null,
    listener: (error: Error | null, device: BleDevice | null) => void
  ): Promise<void>;
  stopDeviceScan(): Promise<void>;
  connectToDevice(id: string, options?: { timeout?: number; requestMTU?: number }): Promise<BleDevice>;
  cancelDeviceConnection(id: string): Promise<BleDevice>;
  isDeviceConnected(id: string): Promise<boolean>;
};

function fullUuid(uuid16: string): string {
  const hex = (uuid16.replace(/[^0-9a-f]/gi, '') || '').padStart(4, '0').toLowerCase();
  return `${'0000'}${hex}-0000-1000-8000-00805f9b34fb`;
}

async function findWriteTarget(
  device: BleDevice
): Promise<{ service: string; characteristic: string; withoutResponse: boolean } | null> {
  const services = await device.services();
  const candidates: { service: string; characteristic: string; withoutResponse: boolean }[] = [];

  for (const service of services) {
    const characteristics = await service.characteristics();
    for (const item of characteristics) {
      if (item.isWritableWithResponse) {
        candidates.push({ service: item.serviceUUID, characteristic: item.uuid, withoutResponse: false });
      } else if (item.isWritableWithoutResponse) {
        candidates.push({ service: item.serviceUUID, characteristic: item.uuid, withoutResponse: true });
      }
    }
  }

  if (candidates.length === 0) {
    const fallback = fullUuid('ffe1');
    for (const service of services) {
      const characteristics = await service.characteristics();
      const ffe1 = characteristics.find((item) => item.uuid.toLowerCase() === fallback);
      if (ffe1) {
        return { service: ffe1.serviceUUID, characteristic: ffe1.uuid, withoutResponse: false };
      }
    }
  }

  return candidates.find((item) => !item.withoutResponse) ?? candidates[0] ?? null;
}

async function ensureAndroidPermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const sdk = Number(Platform.Version);
  if (sdk >= 31) {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN as never,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as never,
    ]);
  } else {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  }
}

function loadBleManager(): BleManagerLike | null {
  try {
    const { BleManager } = require('react-native-ble-plx') as { BleManager: new () => BleManagerLike };
    return new BleManager();
  } catch {
    return null;
  }
}

class BlePrinterBridgeImpl implements BlePrinterBridge {
  private manager: BleManagerLike | null;
  private deviceId: string | null = null;
  private connectedDevice: BleDevice | null = null;
  private target: { service: string; characteristic: string; withoutResponse: boolean } | null = null;

  constructor(manager: BleManagerLike | null) {
    this.manager = manager;
  }

  async isAvailable(): Promise<boolean> {
    return this.manager != null;
  }

  discover(): Promise<BlePrinterDevice[]> {
    return new Promise((resolve) => {
      const manager = this.manager;
      if (!manager) {
        resolve([]);
        return;
      }
      const found = new Map<string, BlePrinterDevice>();
      const finish = () => {
        manager
          .stopDeviceScan()
          .catch(() => undefined);
        resolve(Array.from(found.values()));
      };
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const schedule = () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(finish, SCAN_TIMEOUT_MS);
      };

      manager
        .startDeviceScan(null, null, (error, device) => {
          if (error) {
            finish();
            return;
          }
          if (!device) return;
          const id = device.id;
          if (!found.has(id)) {
            const name = device.name ?? device.localName ?? `Impresora BLE ${id.slice(0, 8)}`;
            found.set(id, { id, name, address: id });
            schedule();
          }
        })
        .then(schedule)
        .catch(() => finish());
    });
  }

  async connect(address: string): Promise<void> {
    const manager = this.manager;
    if (!manager) throw new Error('Bluetooth BLE no disponible en este dispositivo.');
    await ensureAndroidPermissions();
    const device = await manager.connectToDevice(address, { timeout: CONNECT_TIMEOUT_MS });
    await device.discoverAllServicesAndCharacteristics();
    const target = await findWriteTarget(device);
    if (!target) {
      await manager.cancelDeviceConnection(address).catch(() => undefined);
      throw new Error('La impresora no expone un canal de escritura Bluetooth.');
    }
    this.deviceId = address;
    this.connectedDevice = device;
    this.target = target;
  }

  async disconnect(): Promise<void> {
    const manager = this.manager;
    const id = this.deviceId;
    this.deviceId = null;
    this.connectedDevice = null;
    this.target = null;
    if (manager && id) {
      await manager.cancelDeviceConnection(id).catch(() => undefined);
    }
  }

  async write(bytes: number[]): Promise<void> {
    const device = this.connectedDevice;
    const target = this.target;
    if (!device || !target) throw new Error('Impresora no conectada.');
    const chunks = chunkBytes(new Uint8Array(bytes), WRITE_CHUNK_SIZE);
    for (const chunk of chunks) {
      const value = bytesToBase64(chunk);
      if (target.withoutResponse) {
        await device.writeCharacteristicWithoutResponseForService(target.service, target.characteristic, value);
      } else {
        await device.writeCharacteristicWithResponseForService(target.service, target.characteristic, value);
      }
    }
  }

  async isConnected(): Promise<boolean> {
    const manager = this.manager;
    if (!manager || !this.deviceId) return false;
    try {
      return await manager.isDeviceConnected(this.deviceId);
    } catch {
      return false;
    }
  }
}

export function getBlePrinterBridge(): BlePrinterBridge | null {
  if (Platform.OS === 'web') return null;

  const nativeBridge = NativeModules.BluetoothPrinterBridge as BlePrinterBridge | null;
  if (nativeBridge) return nativeBridge;

  return new BlePrinterBridgeImpl(loadBleManager());
}