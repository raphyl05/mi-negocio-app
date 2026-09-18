export function formatTime(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours();
  const hh = hours % 12 === 0 ? 12 : hours % 12;
  const mm = date.getMinutes().toString().padStart(2, '0');
  const suffix = hours < 12 ? 'a.m.' : 'p.m.';
  return `${hh}:${mm} ${suffix}`;
}