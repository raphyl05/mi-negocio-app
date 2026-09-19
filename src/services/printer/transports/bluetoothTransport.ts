import { Platform } from 'react-native';
import type { DiscoveredPrinter, PrintPayload, PrintResult, PrinterTransportInfo } from '../types';
import type { PrinterTransport } from './printerTransport';
import { getBlePrinterBridge } from './bleBridge';

export const BLUETOOTH_PENDING_REASON =
  'Requiere una app compilada con react-native-ble-plx (EAS/development build). En Expo Go no se pueden usar '
  + 'impresoras Bluetooth. Para probar en un celular: npx expo run:android (o run:ios) con una térmica BLE 58 mm.';

// Puente BLE esperado por el transporte. La app usa getBlePrinterBridge(), que da prioridad a un
// módulo nativo propio (BluetoothPrinterBridge) y, si no existe, a react-native-ble-plx.
export interface BluetoothPrinterBridge extends BlePrinterBridgeLike {
  addStatusListener?(listener: (connected: boolean) => void): void;
}

type BlePrinterBridgeLike = {
  isAvailable(): Promise<boolean>;
  discover(): Promise<{ id: string; name: string; address: string }[]>;
  connect(address: string): Promise<void>;
  disconnect(): Promise<void>;
  write(bytes: number[]): Promise<void>;
  isConnected(): Promise<boolean>;
};

export function getBluetoothPrinterBridge(): BluetoothPrinterBridge | null {
  if (Platform.OS === 'web') return null;
  return (getBlePrinterBridge() ?? null) as BluetoothPrinterBridge | null;
}

export function createBluetoothTransport(): PrinterTransport {
  const kind = 'bluetooth' as const;

  return {
    kind,

    info(): PrinterTransportInfo {
      if (Platform.OS === 'web') {
        return { kind, supported: false, reason: 'Bluetooth no aplica en navegador.' };
      }
      const bridge = getBluetoothPrinterBridge();
      if (!bridge) {
        return { kind, supported: false, reason: BLUETOOTH_PENDING_REASON };
      }
      return { kind, supported: true };
    },

    async discover(): Promise<DiscoveredPrinter[]> {
      const bridge = getBluetoothPrinterBridge();
      if (!bridge) return [];
      try {
        const found = await bridge.discover();
        return found.map((item) => ({
          id: `bluetooth:${item.address}`,
          name: item.name,
          type: kind,
          address: item.address,
        }));
      } catch {
        return [];
      }
    },

    async connect(target) {
      const bridge = getBluetoothPrinterBridge();
      if (!bridge || !target.address) {
        throw new Error('Impresora Bluetooth no disponible: falta el módulo nativo.');
      }
      await bridge.connect(target.address);
    },

    async disconnect() {
      const bridge = getBluetoothPrinterBridge();
      if (bridge) await bridge.disconnect();
    },

    async isConnected() {
      const bridge = getBluetoothPrinterBridge();
      if (!bridge) return false;
      try {
        return await bridge.isConnected();
      } catch {
        return false;
      }
    },

    async print(payload: PrintPayload): Promise<PrintResult> {
      const bridge = getBluetoothPrinterBridge();
      if (!bridge) {
        return { ok: false, message: 'Impresora Bluetooth no disponible: falta el módulo nativo.' };
      }
      const { buildEscposBytes } = require('../escpos');
      const bytes = buildEscposBytes(payload.text);
      try {
        await bridge.write(Array.from(bytes));
        return { ok: true, message: 'Ticket enviado a la impresora.' };
      } catch (error) {
        return { ok: false, message: `No se pudo imprimir: ${error instanceof Error ? error.message : 'error desconocido'}` };
      }
    },
  };
}