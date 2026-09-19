export function formatTime(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours();
  const hh = hours % 12 === 0 ? 12 : hours % 12;
  const mm = date.getMinutes().toString().padStart(2, '0');
  const suffix = hours < 12 ? 'a.m.' : 'p.m.';
  return `${hh}:${mm} ${suffix}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

export function parseDateInput(text: string): Date | null {
  const trimmed = text.trim();
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(trimmed);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  let year = parseInt(match[3], 10);
  if (year < 100) year += 2000;

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;

  const date = new Date(year, month - 1, day);
  if (date.getDate() !== day || date.getMonth() !== month - 1) return null;
  return date;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function inDateRange(iso: string, from?: Date, to?: Date): boolean {
  const date = new Date(iso);
  if (from && date < startOfDay(from)) return false;
  if (to && date > endOfDay(to)) return false;
  return true;
}