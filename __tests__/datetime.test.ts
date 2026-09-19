import { endOfDay, formatDate, formatTime, inDateRange, parseDateInput, startOfDay } from '../src/utils/datetime';

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

describe('parseDateInput', () => {
  it('parsea dd/mm/aaaa y dd-mm-aaaa', () => {
    expect(parseDateInput('18/09/2026')).toEqual(new Date(2026, 8, 18));
    expect(parseDateInput('8-9-26')).toEqual(new Date(2026, 8, 8));
  });

  it('rechaza fechas inválidas o inexistentes', () => {
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('abc')).toBeNull();
    expect(parseDateInput('31/02/2026')).toBeNull();
    expect(parseDateInput('13/13/2026')).toBeNull();
    expect(parseDateInput('19/09/1980')).toBeNull();
  });
});

describe('inDateRange', () => {
  const iso = '2026-09-15T14:30:00';

  it('acepta solo la fecha inicial', () => {
    expect(inDateRange(iso, new Date(2026, 8, 15))).toBe(true);
    expect(inDateRange(iso, new Date(2026, 8, 16))).toBe(false);
  });

  it('acepta solo la fecha final', () => {
    expect(inDateRange(iso, undefined, new Date(2026, 8, 15))).toBe(true);
    expect(inDateRange(iso, undefined, new Date(2026, 8, 14))).toBe(false);
  });

  it('acepta un rango inclusivo por día', () => {
    expect(inDateRange(iso, new Date(2026, 8, 1), new Date(2026, 8, 15))).toBe(true);
    expect(inDateRange(iso, new Date(2026, 8, 16), new Date(2026, 8, 30))).toBe(false);
  });

  it('normaliza inicio y fin al día completo', () => {
    expect(inDateRange('2026-09-15T00:00:00', startOfDay(new Date(2026, 8, 15)), endOfDay(new Date(2026, 8, 15)))).toBe(true);
    expect(inDateRange('2026-09-15T23:59:59', startOfDay(new Date(2026, 8, 15)), endOfDay(new Date(2026, 8, 15)))).toBe(true);
  });
});