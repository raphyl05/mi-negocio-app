import { formatTime } from '../src/utils/datetime';

describe('formatTime', () => {
  it('formatea hora y minuto con cero a la izquierda', () => {
    expect(formatTime('2026-09-18T08:43:00')).toBe('08:43');
    expect(formatTime('2026-09-18T05:05:00')).toBe('05:05');
  });

  it('maneja horas de la tarde', () => {
    expect(formatTime('2026-09-18T18:09:00')).toBe('18:09');
  });
});