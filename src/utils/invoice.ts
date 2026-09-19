export function invoiceCodeFor(orderNumber: number): string {
  return `FAC-${String(orderNumber).padStart(4, '0')}`;
}