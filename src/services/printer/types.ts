export type PrinterType = 'bluetooth' | 'system' | 'demo';

export type PrinterState = 'idle' | 'connecting' | 'connected' | 'error';

export type DiscoveredPrinter = {
  id: string;
  name: string;
  type: PrinterType;
  address?: string;
};

export type PrinterConfig = {
  enabled: boolean;
  type?: PrinterType;
  name?: string;
  address?: string;
  connectedAt?: string;
};

export type PrinterStatus = {
  enabled: boolean;
  state: PrinterState;
  type?: PrinterType;
  name?: string;
  label: string;
  ready: boolean;
};

export type PrintPayload = {
  text: string;
  html: string;
  logoUri: string | null;
};

export type PrintResult = {
  ok: boolean;
  message: string;
};

export type PrinterTransportInfo = {
  kind: PrinterType;
  supported: boolean;
  reason?: string;
};