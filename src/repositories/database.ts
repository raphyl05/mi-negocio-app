export function getDatabase(): never {
  throw new Error('SQLite solo está disponible en Android/iOS; en web se usa el repositorio en memoria.');
}