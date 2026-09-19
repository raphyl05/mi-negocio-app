// Interfaz del puente Bluetooth BLE usada por el transporte de impresora.
// Esta implementación base (web/comprobación) devuelve null: el BLE real vive en bleBridge.native.
export interface BlePrinterDevice {
  id: string;
  name: string;
  address: string;
}

export interface BlePrinterBridge {
  isAvailable(): Promise<boolean>;
  discover(): Promise<BlePrinterDevice[]>;
  connect(address: string): Promise<void>;
  disconnect(): Promise<void>;
  write(bytes: number[]): Promise<void>;
  isConnected(): Promise<boolean>;
}

export function getBlePrinterBridge(): BlePrinterBridge | null {
  return null;
}