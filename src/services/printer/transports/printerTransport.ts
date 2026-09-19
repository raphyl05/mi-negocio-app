import type { DiscoveredPrinter, PrintPayload, PrintResult, PrinterType, PrinterTransportInfo } from '../types';

// Cada transporte conoce CÓMO llegar a su tipo de impresora. El servicio solo
// elige el transporte de la configuración guardada y delega en él.
export interface PrinterTransport {
  readonly kind: PrinterType;
  info(): PrinterTransportInfo;
  discover(): Promise<DiscoveredPrinter[]>;
  connect(target: { name?: string; address?: string }): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  print(payload: PrintPayload): Promise<PrintResult>;
}

export function transports(): PrinterTransport[] {
  // Carga diferida para no arrastrar expo-print al bundle del test unitario.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createSystemPrintTransport } = require('./systemPrintTransport');
  const { createBluetoothTransport } = require('./bluetoothTransport');
  const { createDemoTransport } = require('./demoPrintTransport');
  return [createBluetoothTransport(), createSystemPrintTransport(), createDemoTransport()];
}

export function transportByKind(kind?: PrinterType): PrinterTransport {
  return transports().find((transport) => transport.kind === kind) ?? createNoneTransport();
}

function createNoneTransport(): PrinterTransport {
  return {
    kind: 'demo',
    info(): PrinterTransportInfo {
      return { kind: 'demo', supported: false, reason: 'Sin transporte' };
    },
    async discover() {
      return [];
    },
    async connect() {},
    async disconnect() {},
    async isConnected() {
      return false;
    },
    async print() {
      return { ok: false, message: 'No hay impresora configurada.' };
    },
  };
}