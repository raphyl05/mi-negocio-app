# INFORME-F4 — Autenticación server (completar)

**Fase:** F4 — Autenticación server
**Contrato que verifica:** `docs/API-CONTRACT.md` PARTE 5 (`5.1` token session, `5.2` endpoints, reglas de seguridad), PARTE 20 (recuperación), + matrices de la PARTE 41.
**Cierre de anotaciones de F3** (`INFORME-F3.md`: "No implementadas"): `POST /auth/logout`, `/auth/change-password`, `/auth/me`.
**Estado:** APROBADO CON ANOTACIONES
**Fecha:** 2026-09-21

## Objetivo

Cerrar lo que faltaba del convenio de autenticación: logout, cambio de contraseña con
revocación por `changeEpoch`, perfil/membresías (`/auth/me`), reuso de refresh = 409,
rate limiting en login/registro/refresh (IP + cuenta + dispositivo) y claim `jti` en el JWT.

## Qué se implementó

| Elemento | Detalle | Contrato |
|---|---|---|
| `POST /auth/logout` | body `{ refreshToken }` → `204`; desactiva la sesión y su refresh. Idempotente (refresh desconocido też `204`). Sin auth (se revoca por token). | P.5.2 |
| `POST /auth/change-password` | auth obligatorio; valida `currentPassword` (Argon2), actualiza hash, **incrementa `users.changeEpoch`**, desactiva **todas** las sesiones → `204`. El dispositivo emisor queda sin sesión (debe re-login con la nueva contraseña). | P.5.2 + P.5.1 |
| `GET /auth/me` | auth; perfil + membresías, sin emitir tokens. Alias canónico de `/auth/session` (se conserva por compatibilidad). | P.5.2 |
| Revocación por `changeEpoch` | claim `cep` (epoch del `changeEpoch` al emitir) en el JWT; `OnTokenValidated` compara con `users.changeEpoch` en **todos** los endpoints autenticados; también se valida en `/auth/refresh` (`session.CreatedAt`) y de refuerzo en `AccessService.ResolveAsync`. Token previo al cambio → `401`. | P.5.1 (obligatorio §5) |
| Reuso de refresh | refresh ya rotado o revocado → **`409 TOKEN_REUSE`** (señal de robo). | P.5.2 (nota) |
| Rate limiting | bucket fijo en memoria (60 s): login IP 300 / cuenta 8 / dispositivo 20; register IP 120 / cuenta 8; refresh IP 300 / dispositivo 30. → `429 RATE_LIMITED` con header `Retry-After`. Aplicado **antes** de verificar credenciales (anti-enumeración). | P.5 reglas |
| `jti` claim | JWT ahora incluye `jti` (además de `sub`, `busid`, `dev`, `role`). | P.5.1 |

### Archivos tocados

- `src/Vendelo.Api/Common/RateLimiter.cs` (nuevo) — fixed-window in-memory.
- `src/Vendelo.Api/Common/AppException.cs` — `RetryAfterSeconds` (init) para 429.
- `src/Vendelo.Api/Common/Dtos.cs` — middleware setea `Retry-After`; DTOs `LogoutRequestDto`, `ChangePasswordRequestDto`.
- `src/Vendelo.Api/Auth/TokenService.cs` — claims `jti` y `cep`; `CreateAccessToken` recibe `changeEpoch`.
- `src/Vendelo.Api/Common/Access.cs` — refuerzo `cep` vs `users.changeEpoch` por request.
- `src/Vendelo.Api/Program.cs` — `RateLimiter` singleton; `OnTokenValidated` (revocación global).
- `src/Vendelo.Api/Endpoints/AuthEndpoints.cs` — rutas nuevas, reuso 409, rate-limit, `changeEpoch` en refresh/issue.
- `tests/.../AuthF4Tests.cs` (nuevo) + `AuthFlowTests.cs` (expectativa de reuso a 409).

## Verificación

| Ítem | Resultado |
|---|---|
| `dotnet build Vendelo.slnx` | **0 errores** · 15 warnings CS8604 (benignos, preexistentes: `DeviceIdOf`→`ResolveAsync` param no-null; `Json.DeserializeDict`) |
| `dotnet test Vendelo.slnx` | **36/36** aprobados (27 previos + 9 nuevos), 25 s |
| Tests F4 | logout 204 + revocación; `/auth/me` 200 (sin tokens) y 401 sin token; change-password: 204, viejo token → 401, vieja contraseña → 401, nueva → 200; wrong current → 400 `INVALID_PASSWORD`; refresh tras change-password → 409; refresh reusado → 409 `TOKEN_REUSE`; login >budget → 429 `RATE_LIMITED` + `Retry-After`; claims `cep`/`jti` presentes |
| Compatibilidad | Paquete web/RN sin cambios (`src/` intacto); contratos previos (F1–F3.1) sin romper |

## Anotaciones (no bloqueantes)

1. **Rate limiter en memoria**: por instancia (monolito de 1 nodo, correcto para el MVP). Para multi-instancia se necesita store distribuido → **F5** (respaldo infra).
2. **Recuperación de cuenta** (PARTE 20: request/verify/reset): sigue como placeholder genérico (`POST /accounts/recover`), porque la app aún no recopila email/teléfono (GAP PARTE 36-G8/G13) ni hay canal de envío. Se implementará con la fase de cuenta del cliente.
3. **`change-password`**: `changeEpoch` revoca todas las sesiones, incluida la actual (coherente con P.5.1). El cliente debe re-login.
4. **`session.Active` vs `revoked_at`**: no existe columna `revoked_at` en `sessions`; la revocación usa `Active=false` (F3 decidió así; DDL de migración en F5 si se requiere).
5. **Identificador**: login por email **o** teléfono ya cubierto en F3.
6. **`X-Device-Id`** header no obligatorio (el `deviceId` viaja en el token/body). Se revisará en F4.1.

## Siguiente fase (pendiente de autorización)

- **[F4.1]** Auditoría de seguridad: IDOR, permisos/roles, aislamiento multi-negocio, rate limiting,
  gestión de tokens, logs/auditoría.
- **[F5]** Sincronización completa + despliegue (PostgreSQL real, migraciones EF, hardening `AllowedHosts`,
  logging por `ILogger`).
- **[F5.1]** Conectar cliente RN ↔ API.