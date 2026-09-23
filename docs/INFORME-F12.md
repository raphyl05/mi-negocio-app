# Informe F12 — Backend listo para servidor público (Docker + migraciones automáticas + config por env)

## Alcance
- Esperado: preparar el backend ASP.NET Core para que **personas reales puedan usarlo** desde un servidor público, sin exponer secretos de desarrollo.
- Implementado: contenedor Docker multi-etapa (.NET 10), arranque que aplica migraciones EF automáticamente en Npgsql (producción), escucha en `$PORT` (Railway/Render/Fly), secretos 100% inyectados por variables de entorno con **fail-fast** si faltan, `docker-compose.yml` local para probar contra PostgreSQL real y documentación de despliegue.

## Backend — Cambios implementados

### `backend/Dockerfile` + `backend/.dockerignore`
- Multi-stage: `mcr.microsoft.com/dotnet/sdk:10.0` (build/publish `Release` con restore cacheado) → `mcr.microsoft.com/dotnet/aspnet:10.0` (runtime).
- `ASPNETCORE_URLS=http://+:8080`, `EXPOSE 8080` y **healthcheck** que verifica `/api/v1/health` (el endpoint real que consulta la BD; responde 503/degraded si falla).

### `backend/src/Vendelo.Api/Program.cs`
- **Puerto desde el host**: si existe la env var `PORT` (la inyectan Railway/Render/Fly), la API escucha en `http://0.0.0.0:{PORT}`; si no, usa 8080 del contenedor.
- **Migraciones automáticas en producción**: cuando `Database:Provider = Npgsql` el arranque ejecuta `db.Database.MigrateAsync()` (crea la BD y aplica versiones futuras sin correr scripts manuales). En SQLite (dev/tests) se conserva `EnsureCreatedAsync` — los 44/44 tests siguen verdes.

### `backend/src/Vendelo.Api/appsettings.Production.json`
- Se eliminó la clave JWT de desarrollo hardcodeada: `Jwt__Key` ahora parte vacía y debe venir por ambiente.
- `ConnectionStrings__Vendelo` con valor local por defecto, sobrescribible por env var.

### `backend/src/Vendelo.Api/Common/Cipher.cs` (firma de `Encrypt`/`TryDecrypt`)
- Ahora reciben `IHostEnvironment`: en **Development** se usa la clave AES-GCM de respaldo (como siempre), pero en **producción `Encryption__Key` es obligatoria** — si falta, el arranque de los endpoints de respaldo falla con `InvalidOperationException` en lugar de cifrar con una clave conocida. `BusinessEndpoints.cs` resuelve `IHostEnvironment` vía `http.RequestServices`.

### `backend/docker-compose.yml`
- Pila local `postgres:17-alpine` + `api` (build desde `./Dockerfile`) con las env vars de producción ya mapeadas (conexión `db`, `Database__Provider=Npgsql`, `Jwt__Key`, `Encryption__Key`), `depends_on` con healthcheck de Postgres y volumen persistente.

## Documentación
- `README.md`: nueva sección **Despliegue en servidor público** (cómo usar Docker/compose, tabla de variables obligatorias y fail-fast, pasos en Railway/Render/Fly/VPS, y cómo apuntar la app vía `EXPO_PUBLIC_API_URL`) y referencia a F12 en "Lo que falta".
- Este `docs/INFORME-F12.md`.

## Variables de entorno obligatorias en producción
`PORT`, `ConnectionStrings__Vendelo`, `Database__Provider=Npgsql`, `Jwt__Key` (≥ 32 bytes), `Encryption__Key`; opcionales `Jwt__Issuer`/`Jwt__Audience`.

## Verificación
- Backend: **44/44 tests pasando**, `dotnet build` 0 errores.
- `docker build` **pendiente de validar**: Docker no está instalado en la máquina de desarrollo (las imágenes sdk/aspnet 10.0 son las oficiales de .NET, multi-stage estándar).
- No hay cambios de esquema ni del contrato API (solo arranque/config), por lo que el cliente no requiere cambios.