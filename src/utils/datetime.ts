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