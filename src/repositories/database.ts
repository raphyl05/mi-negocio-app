export function getDatabase(): never {
  throw new Error('SQLite solo está disponible en Android/iOS; en web se usa el repositorio en memoria.');
}

// En web no hay archivo de BD; el reseteo real ocurre al descartar las fachadas.
export async function deleteDatabaseFile(): Promise<void> {
  // sin operación
}