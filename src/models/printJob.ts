export type PrintJobStatus = 'queued' | 'printing' | 'done' | 'failed';

export type PrintJob = {
  id: string;
  orderId: string;
  orderNumber: number;
  type: 'ticket' | 'receipt' | 'kitchen';
  status: PrintJobStatus;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
};
