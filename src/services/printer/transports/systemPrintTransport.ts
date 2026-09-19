import type { DiscoveredPrinter, PrintPayload, PrintResult, PrinterTransportInfo } from '../types';
import type { PrinterTransport } from './printerTransport';

// Imprime con el diálogo de impresión del sistema: en Android, la cola de
// impresión (incluye impresoras integradas en terminales POS), en iOS AirPrint
// y en navegador window.print(). Funciona hoy en Expo Go.
export function createSystemPrintTransport(): PrinterTransport {
  const kind = 'system' as const;

  return {
    kind,

    info(): PrinterTransportInfo {
      return { kind, supported: true };
    },

    async discover(): Promise<DiscoveredPrinter[]> {
      return [
        {
          id: 'system',
          name: 'Impresora del sistema / integrada',
          type: kind,
          address: 'system',
        },
      ];
    },

    async connect() {},

    async disconnect() {},

    async isConnected() {
      return true;
    },

    async print(payload: PrintPayload): Promise<PrintResult> {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Print = require('expo-print');
        await Print.printAsync({ html: payload.html });
        return { ok: true, message: 'Enviado al diálogo de impresión del sistema.' };
      } catch (error) {
        return {
          ok: false,
          message: `No se pudo imprimir: ${error instanceof Error ? error.message : 'error desconocido'}`,
        };
      }
    },
  };
}