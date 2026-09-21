import { assertOrderTransition } from '../src/utils/orderState';

describe('assertOrderTransition', () => {
  it('permite el flujo normal y la anulación desde pending', () => {
    expect(() => assertOrderTransition('pending', 'pending')).not.toThrow();
    expect(() => assertOrderTransition('pending', 'paid')).not.toThrow();
    expect(() => assertOrderTransition('pending', 'voided')).not.toThrow();
  });

  it('permite anular una venta pagada', () => {
    expect(() => assertOrderTransition('paid', 'voided')).not.toThrow();
  });

  it('prohíbe re-edit-proteger una venta ya pagada o anulada', () => {
    expect(() => assertOrderTransition('paid', 'paid')).toThrow();
    expect(() => assertOrderTransition('voided', 'voided')).toThrow();
    expect(() => assertOrderTransition('voided', 'pending')).toThrow();
    expect(() => assertOrderTransition('voided', 'paid')).toThrow();
  });

  it('prohíbe volver una venta al estado pendiente', () => {
    expect(() => assertOrderTransition('paid', 'pending')).toThrow();
    expect(() => assertOrderTransition('voided', 'pending')).toThrow();
  });
});