// Decide qué archivos de respaldo automático borrar para respetar:
// 1) un tope por cantidad (se conservan los más recientes) y
// 2) un tope por peso total (si el conjunto sigue superando el máximo,
//    se descartan los más antiguos hasta caber).
// Devuelve los nombres de archivo a eliminar (los más viejos primero).
export function planBackupPrune(
  files: string[],
  maxCount: number,
  maxTotalBytes: number,
  sizeOf: (fileName: string) => number,
): string[] {
  const sorted = files
    .filter((f) => f.length > 0)
    .sort();

  const toDelete: string[] = [];
  const byCount = sorted.slice(0, Math.max(0, sorted.length - maxCount));
  toDelete.push(...byCount);

  const remaining = sorted.slice(Math.max(0, sorted.length - maxCount));
  const sizes = new Map<string, number>(remaining.map((f) => [f, Math.max(0, sizeOf(f))]));
  let total = remaining.reduce((acc, f) => acc + (sizes.get(f) ?? 0), 0);

  for (const file of remaining) {
    if (total <= maxTotalBytes) break;
    toDelete.push(file);
    total -= sizes.get(file) ?? 0;
  }

  return toDelete;
}

// Decide qué archivos sobrantes de la caché se borran: conserva solo la
// cuarentena pre-restauración más reciente y elimina los exportes de respaldo
// que ya fueron compartidos. Puro y testeable.
export function planCacheCleanup(files: string[]): string[] {
  const preRestore = files
    .filter((f) => f.startsWith('vendelo-pre-restore-') && f.endsWith('.json'))
    .sort();
  const shared = files.filter((f) => f.startsWith('vendelo-backup-') && f.endsWith('.json'));
  return [...preRestore.slice(0, Math.max(0, preRestore.length - 1)), ...shared];
}