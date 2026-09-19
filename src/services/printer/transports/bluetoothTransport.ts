import { NativeModules, Platform } from 'react-native';
import type { DiscoveredPrinter, PrintPayload, PrintResult, PrinterTransportInfo } from '../types';
import type { PrinterTransport } from './printerTransport';

export const BLUETOOTH_PENDING_REASON =
  'Requiere el módulo nativo Bluetooth (render a 58 mm) en una versión de desarrollo (EAS/dev build). Desde Expo Go aún no se pueden listar impresoras Bluetooth.';

// Interfaz del puente nativo esperado. Cuando integres una impresora real:
//   1) Instala el paquete nativo (p. ej. react-native-bluetooth-escpos-printer) o crea un
//      módulo nativo que exponga `BluetoothPrinterBridge`.
//   2) Implementa este puente (discover/connect/write/isConnected/onStatus).
//   3) Nada más: el resto del servicio (config, botones de imprimir y auto-reconexión) ya funciona.
export interface BluetoothPrinterBridge {
  isAvailable(): Promise<boolean>;
  discover(): Promise<{ id: string; name: string; address: string }[]>;
  connect(address: string): Promise<void>;
  disconnect(): Promise<void>;
  write(bytes: number[]): Promise<void>;
  isConnected(): Promise<boolean>;
  addStatusListener?(listener: (connected: boolean) => void): void;
}

export function getBluetoothPrinterBridge(): BluetoothPrinterBridge | null {
  if (Platform.OS === 'web') return null;
  return (NativeModules.BluetoothPrinterBridge ?? null) as BluetoothPrinterBridge | null;
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