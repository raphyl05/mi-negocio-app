# Backend previsto — Vendelo App (documentación de arquitectura)

El MVP de Vendelo App funciona **100% offline** y no requiere servidor. Este documento describe la
arquitectura recomendada para el backend futuro (respaldo en la nube, sincronización
multi-dispositivo y facturación electrónica). **No hay servidor en este repositorio todavía.**

> Nota de alineación: la Fase 32 del README mencionaba "ASP.NET Core + PostgreSQL". La auditoría
> técnica de 2026 recomienda TypeScript + Fastify (mismo lenguaje del frontend, tipado compartido,
> ecosistema ligero), y este documento es la referencia de ahora en adelante.

## Stack recomendado

- **TypeScript estricto** (mismos tipos compartidos que la app).
- **Fastify** para HTTP (validación de esquemas con TypeBox/JOI, ESCAdo, tests con `node:test` o vitest).
- **Base de datos PostgreSQL** (RDS o similar). Sin ORM pesado: `node-postgres` + migraciones SQL versionadas.
- **Docker** para desarrollo local (misma versión de Postgres que en producción).
- Despliegue: cualquier PaaS/VPS; la app es stateless (JWT en headers).

## Cómo consumirá la app este backend

La app sigue siendo offline-first: escribe local (SQLite/AsyncStorage/SecureStore) y **sincroniza**
cuando hay red. El backend es un parque de recepción/reconciliación, no la única fuente de verdad
en tiempo real.

### Sincronización prevista

- `POST /sync` — batch embedador de cambios locales (órdenes, productos, cierres de caja,
  clientes, proveedores) con `createdAt`/`updatedAt` y deviceId para detectable conflicto.
- `GET /sync?since=<timestamp>` — cambios del servidor posteriores a `since`.
- El cliente resuelve conflictos con la regla documentada de Vendelo:
  - `createdAt` más reciente gana para ajustes editoriales (precio, nombre).
  - Venta pagada/anulada: **la anulación local siempre gana** y el correlativo nunca se reasigna
    (precios congelados, regla de Fase 12).

### Respaldos de datos

- `PUT /backups/:userId` — subida del bundle JSON completo (ya sanitizado: **sin password_hash ni
  salt**; solo `{ id, username, createdAt }`).
- `GET /backups/:userId/latest` — recuperación para restaurar.
- El bundle se cifra **en el cliente** antes de subir (clave derivada del password del usuario).

### Autenticación

- Contraseña derivada con **PBKDF2-HMAC-SHA256, 100.000 iteraciones** (mismo estándar que usa la
  app hoy, ver `src/utils/password.ts`). No mandar el hash del cliente: el cliente se autentica en
  el servidor, que conserva su propio hash (bcrypt/argon2) con sal por usuario.
- OAuth estándar (`expo-auth-session` ya está en `package.json`) para identidad opcional.

## Qué NO hará el backend (límites para no contaminar el offline-first)

- No será fuente de verdad para la caja (el cierre es un snapshot local inmutable).
- No reescribirá ventas pagadas/anuladas (regla `assertOrderTransition`).
- No recibirá nunca el `passwordHash`/`passwordSalt`/pregunta de seguridad del usuario de la app.
- No puede bloquear la operación de la app si el servidor cae (cola offline en el cliente).

## Pruebas que deberá tener el backend

- Vectores conocidos del serializador de respaldo (compatibles con `src/utils/backup.ts`).
- Matriz de conflictos de sincronización (venta pagada vs. anulada local, edición de precios).
- Idempotencia de `POST /sync` (deviceId + ids para repetir sin duplicar).
- Test de que ningún endpoint acepta `passwordHash` en el payload de respaldo.

## Cuándo construirlo

Solo cuando la app demande sincronización o respaldo remoto (retomar el flujo de Google Drive de la
Fase 30). Hasta entonces el MVP es autosuficiente y este documento no obliga a mantener un servidor.