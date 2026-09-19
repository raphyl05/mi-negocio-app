import type { DiscoveredPrinter, PrintPayload, PrintResult, PrinterTransportInfo } from '../types';
import type { PrinterTransport } from './printerTransport';

// Impresora simulada para probar el flujo completo (configurar, conectar y
// imprimir) sin hardware. No envía nada a ninguna parte; solo simula.
export function createDemoTransport(): PrinterTransport {
  const kind = 'demo' as const;

  return {
    kind,

    info(): PrinterTransportInfo {
      return { kind, supported: true };
    },

    async discover(): Promise<DiscoveredPrinter[]> {
      return [
        {
          id: 'demo',
          name: 'Prueba (impresión simulada)',
          type: kind,
        },
      ];
    },

    async connect() {},

    async disconnect() {},

    async isConnected() {
      return true;
    },

    async print(payload: PrintPayload): Promise<PrintResult> {
      await new Promise((resolve) => setTimeout(resolve, 400));
      void payload;
      return {
        ok: true,
        message: 'Impresión enviada (modo prueba). Conecta una impresora real desde Configuración → Impresora.',
      };
    },
  };
}