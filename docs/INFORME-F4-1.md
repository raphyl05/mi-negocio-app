# INFORME-F4.1 — Auditoría de seguridad

**Fase:** F4.1 — Auditoría de seguridad (IDOR, permisos, isolation, rate limiting, tokens, logs)
**Alcance:** `docs/API-CONTRACT.md` PARTE 22 (anti-IDOR), matríces de roles PARTE 41, reglas de seguridad PARTE 5, error matrix PARTE 33.
**Estado:** APROBADO CON ANOTACIONES
**Fecha:** 2026-09-21
**Base:** código de F3/F4 ya auditado en F3.1; esta fase audita las 6 dimensiones **y corrige** los hallazgos accionables.

---

## 1. IDOR (Insecure Direct Object References) — PASS

Regla de oro (PARTE 22) cumplida: **el `id` de la ruta jamás autoriza; la autoridad es el token**.

| Superficie | Mecanismo | Verificado |
|---|---|---|
| `CatalogEndpoints`, `OrderEndpoints`, `SyncEndpoints` | `AccessAsync`: `ResolveAsync` (busid del token + membresía activa) + `a.Business.Id != businessId → 404` | ✔ |
| `BusinessEndpoints` (get/patch/capabilities/devices/backups/revoke) | check `a.Business.Id != id → 404` antes de tocar datos | ✔ |
| Entidades | toda consulta filtra `x.BusinessId == businessId` (productos, clientes, órdenes, movimientos, cierres, backups, sync_batches) | ✔ catálogo, órdenes, sync (líneas 40-45, 104-…, 166…) |
| Sync push | cada batch se materializa con el `businessId` de la URL (no el del payload); `MergeBusiness` exige `biz.Id != businessId → false`; dedupe `SyncBatches` por `(business, requestId)` | ✔ |
| `RegisterDevice` | `req.BusinessId != a.Business.Id → 404` | ✔ |

**Evidencia automatizada** (`SecurityF4_1Tests`): token A con negocio B → lecturas/escrituras/catálogo/devices/pull/push **404**; entidad conocida en negocio ajeno al editar/eliminar → **404**; negocio A intacto.

## 2. Permisos / roles — PASS (2 observaciones)

- Matriz por rol en `AccessService`: owner (todo), admin (todo menos `backups`), cashier (catálogo/órdenes/caja lectura), waiter (`orders.create|read|tables`), kitchen (`orders.read|kitchen.status`), printer (`orders.read|printer.feed`).
- Cada mutación sensible exige el permiso: `products.crud`, `orders.create|pay|void`, `cash.close`, `backups`, `members.devices`, `capabilities`.
- Interacción dispositivo×membresía vía `Intersect` (rol de dispositivo restringe al de membresía).
- **Evidencia**: tests preexistentes de waiter/cashier → 403 (`CatalogAndAccessTests`).

**Observaciones (no bloqueantes):**
- O1. `GET /businesses/{id}/devices`, `GET .../capabilities` y `GET /businesses` exigen solo membresía activa (lectura de información del propio negocio; aceptable). Decisión para F5.
- O2. El permiso `stock.view` está definido pero **no se exige en ningún endpoint** (el stock usa `products.crud`). Revisar en F5; no es riesgo (es más restrictivo pensarlo como lectura).

## 3. Aislamiento multi-negocio — PASS

- `busid` claim + membresía **activa** re-verificada en `ResolveAsync` por request; login fija el negocio activo; sin rutas de cambio de negocio dentro de la cuenta (separación por sesión).
- Secuencias, sync_batches, backups y ledgers escopados por `BusinessId`. Sin consultas cruzadas entre negocios.
- Restore de backup limitado al negocio autorizado (`DbBackup.RestoreAsync` filtra por `businessId`).
- Evidencia: tests de aislamiento de F4.1 (§1).

## 4. Rate limiting — CORREGIDO  (era el hallazgo pendiente)

Contrato: rate-limit en auth **y** sync/backups por IP + cuenta + dispositivo.

- **F4 (ya cerrado):** login/registro/refresh por IP/cuenta/dispositivo, 429 `RATE_LIMITED` + `Retry-After`, aplicado **antes** de verificar credenciales.
- **F4.1 (nuevo):** sync y backups:
  - `sync/pull`: 600/min por negocio · 1200/min por IP.
  - `sync/push`: 120/min por negocio · 480/min por IP.
  - backups: create 12 · restore 5 · delete 30 · list 120 (por negocio y por IP).
- Implementado con el `RateLimiter` en memoria (ya de F4) + helper `RateLimiter.Enforce`.
- Evidencia: unit tests del limiter (budget/ventana, 429 `Retry-After`) en `SecurityF4_1Tests`.

**Anotación:** limiter en memoria = por instancia. Multi-instancia (escala horizontal) → store distribuido (Redis) en **F5**.

## 5. Tokens — PASS (+1 hardening)

- JWT 15 min con `jti` + `cep`; refresh opaco rotativo (48 h activo, 30 días absolutos), hash en BD (`sessions.refresh_token_hash`); reuso → 409 `TOKEN_REUSE`; `changeEpoch` revoca todas las sesiones vía `OnTokenValidated` (todos los endpoints). ClockSkew 30 s. Secretos por env con fallback local solo en Development (documentado).
- **Hardening añadido en F4.1:** igualación temporal en `login` — cuando el identifier no existe se ejecuta una verificación Argon2 "dummy" para neutralizar la enumeración por timing.
- No se registran tokens ni contraseñas (ver §6).

## 6. Logs / auditoría — CORREGIDO (parcialmente)

- **Corregido:** los `500` se logean con `ILogger` (método, ruta, requestId) en lugar de `Console.Error`; se eliminó el `CreateAsyncScope` muerto del middleware.
- No se logean `X-Request-Id`/bodies/tokens/contraseñas en ningún punto.
- **Anotación (no bloqueante):** no existe bitácora de eventos sensibles (register, change-password, restore, revoke device, logout). Recomendación para F5: tabla `audit_log` (user, business, event, meta sin datos sensibles) o integración con el proveedor de logs del host.

---

## Verificación

| Ítem | Resultado |
|---|---|
| Build | **0 errores** · 15 warnings CS8604 benignos (preexistentes) |
| `dotnet test Vendelo.slnx` | **40/40** aprobados (36 previos + 4 nuevos F4.1) |
| Cobertura F4.1 | aislamiento/IDOR (6 verificaciones por negocio ajeno + entidad con id conocido), rate-limiter unit (budget, 429, Retry-After), roles (preexistente) |
| Regresión | F1–F4 protegidos; `src/` del cliente sin cambios |

## Anotaciones → fases futuras

1. `E1` limiter en memoria → Redis/store distribuido (F5).
2. `E2` `stock.view` sin consumidor y permisos de lectura de devices/capabilities (decisión F5).
3. `E3` bitácora de audit de eventos sensibles (F5/F6).
4. `E4` recuperación de cuenta PARTE 20 (placeholder) cuando exista canal email/SMS (fase de cuenta del cliente, G8/G13).
5. `E5` paginación de `GET /orders` y snapshot pull (PDF ya listado en F3.1) → F5.

## Estado de la secuencia

F1 · F1.1 · F2 · F3 ✔ · F3.1 ✔ · **F4.1 ✔** — pendientes: **F5** (despliegue + PostgreSQL real + migraciones + hardening host), **F5.1** (conectar cliente RN ↔ API), luego F6+.