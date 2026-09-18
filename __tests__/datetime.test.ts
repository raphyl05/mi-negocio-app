import { formatTime } from '../src/utils/datetime';

describe('formatTime', () => {
  it('formatea horas de la mañana en a.m.', () => {
    expect(formatTime('2026-09-18T08:43:00')).toBe('8:43 a.m.');
    expect(formatTime('2026-09-18T05:05:00')).toBe('5:05 a.m.');
  });

  it('formatea horas de la tarde en p.m.', () => {
    expect(formatTime('2026-09-18T18:09:00')).toBe('6:09 p.m.');
    expect(formatTime('2026-09-18T14:00:00')).toBe('2:00 p.m.');
  });

  it('maneja medianoche y mediodía', () => {
    expect(formatTime('2026-09-18T00:05:00')).toBe('12:05 a.m.');
    expect(formatTime('2026-09-18T12:30:00')).toBe('12:30 p.m.');
  });
});