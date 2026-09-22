import { planBackupPrune, planCacheCleanup } from '../src/utils/backupPrune';

const sizeOf = (f: string) => sizes[f] ?? 0;
let sizes: Record<string, number> = {};

describe('planBackupPrune', () => {
  beforeEach(() => {
    sizes = {};
  });

  it('conserva los más recientes cuando hay más archivos que el tope', () => {
    const files = ['respaldo-auto-1.json', 'respaldo-auto-2.json', 'respaldo-auto-3.json'];
    const toDelete = planBackupPrune(files, 2, 1000, sizeOf);
    expect(toDelete).toEqual(['respaldo-auto-1.json']);
  });

  it('no borra nada por cantidad si no se pasa el tope', () => {
    const files = ['a.json', 'b.json'];
    expect(planBackupPrune(files, 5, 1000, sizeOf)).toEqual([]);
  });

  it('impone el peso total aunque haya pocos archivos (borra los de mayor a menor antigüedad)', () => {
    const files = ['r-1.json', 'r-2.json', 'r-3.json'];
    sizes = { 'r-1.json': 4, 'r-2.json': 4, 'r-3.json': 10 };
    const toDelete = planBackupPrune(files, 20, 10, sizeOf);
    expect(toDelete).toEqual(['r-1.json', 'r-2.json']);
  });

  it('nunca borra más archivos de los necesarios para caber', () => {
    const files = ['r-1.json', 'r-2.json'];
    sizes = { 'r-1.json': 25, 'r-2.json': 20 };
    const toDelete = planBackupPrune(files, 10, 30, sizeOf);
    expect(toDelete).toEqual(['r-1.json']);
  });

  it('combina tope por cantidad y por peso', () => {
    const files = ['r-1.json', 'r-2.json', 'r-3.json', 'r-4.json'];
    sizes = { 'r-1.json': 1, 'r-2.json': 1, 'r-3.json': 1, 'r-4.json': 1 };
    const toDelete = planBackupPrune(files, 2, 1, sizeOf);
    expect(toDelete.sort()).toEqual(['r-1.json', 'r-2.json', 'r-3.json']);
  });

  it('filtra cadenas vacías y trata tamaños negativos como cero (el tope de peso sigue rigiendo)', () => {
    const files = ['', 'r-1.json', 'r-2.json'];
    sizes = { 'r-1.json': -5, 'r-2.json': 10 };
    const toDelete = planBackupPrune(files, 10, 8, sizeOf);
    expect(toDelete).toEqual(['r-1.json', 'r-2.json']);
  });

  it('con lista vacía no borra nada', () => {
    expect(planBackupPrune([], 5, 1000, sizeOf)).toEqual([]);
  });
});

describe('planCacheCleanup', () => {
  it('conserva solo la cuarentena pre-restauración más reciente', () => {
    const files = [
      'vendelo-pre-restore-20260101.json',
      'vendelo-pre-restore-20260922.json',
      'otro-archivo.png',
    ];
    expect(planCacheCleanup(files)).toEqual(['vendelo-pre-restore-20260101.json']);
  });

  it('borra los exportes de respaldo ya compartidos', () => {
    const files = ['vendelo-backup-2026-01-01.json', 'vendelo-backup-2026-09-22.json', 'logo.png'];
    expect(planCacheCleanup(files).sort()).toEqual([
      'vendelo-backup-2026-01-01.json',
      'vendelo-backup-2026-09-22.json',
    ]);
  });

  it('con una sola cuarentena no borra nada', () => {
    expect(planCacheCleanup(['vendelo-pre-restore-20260922.json'])).toEqual([]);
  });

  it('no toca archivos que no pertenecen al patrón', () => {
    expect(planCacheCleanup(['a.png', 'b.json'])).toEqual([]);
  });
});