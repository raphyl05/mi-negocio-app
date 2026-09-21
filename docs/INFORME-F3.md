# Vendelo App — INFORME F3: Backend Source of Truth (verificación)

> **Fase:** F3 — IMPLEMENTACIÓN. Verificación final de `backend/` contra
> `docs/API-CONTRACT.md` (49 PARTES + F2.2/F2.2-B) y `docs/BACKEND-F3-CONTRACT.md`.
> Stack: ASP.NET Core Minimal API (net10.0) + EF Core 10, PostgreSQL 17 en producción,
> SQLite en tests. Fecha: 2026-09-21.

## 1. Veredicto

**APROBADO CON ANOTACIONES** — F3 cumple el contrato de backend para la fase, con build limpio,
27/27 tests de integración en verde y sin cambios en la app cliente (298/298 + `tsc --noEmit`).
Las anotaciones son GAPs conocidos/fase futura o mejoras no bloqueantes (sección 5).
**No se inicia F3.1 sin autorización explícita.**

## 2. Verificación objetiva

| Ítem | Resultado |
|---|---|
| `dotnet build backend/Vendelo.slnx -t:Rebuild` | 0 errores, 15 warnings CS8604 nullability (benignos) |
| `dotnet test backend/Vendelo.slnx` | **27/27 pass** (AuthFlow 8, CatalogAndAccessTests 7, OrderAndSyncTests 12) |
| `npm test` (cliente) | 35 suites / **298 tests pass** (sin cambios) |
| `npm run typecheck` (`tsc --noEmit`) | sin errores (sin cambios) |
| Cambios en `src/` del cliente | ninguno; `package.json` intacto |

## 3. Bugs encontrados y corregidos durante F3

1. **Argon2 (Isopoh v2.0.0):** la sobrecarga `Hash(string, string, …)` tiene como 2.º string el
   `secret`, no el `salt`; además `Argon2Version.Nineteen`/`Argon2Type.HybridAddressing`. `Verify`
   fallaba contra hashes propios. Se reescribió `PasswordHasher` sobre `Argon2Config` (argon2id,
   m=65536, t=3, p=1, salt 16B); roundtrip con test. (`Auth/Security.cs`)
2. **Dedupe de registro:** `AnyAsync(x => x.Email == email || x.Phone == phone)` con `phone == null`
   traducía a `Phone IS NULL` → el 2.º registro del mismo negocio daba 409 falso. Chequeos separados
   y null-aware por tipo de identifier. (`Endpoints/AuthEndpoints.cs`)
3. **SQLite + `DateTimeOffset`:** el driver no soporta `ORDER BY DateTimeOffset` ni traduce
   `.UtcDateTime`. Se añadió un value-converter global `DateTimeOffset → DateTime (UTC)` en
   `VendeloDbContext` (mismo storage/orden en ambos providers) y se devolvieron los `OrderBy` a su
   forma natural. (`Data/VendeloDbContext.cs`)
4. **Capabilities "fantasma":** los valores de `Dictionary<string, object?>` llegan al
   model-binder como `JsonElement`, no `bool` → `v is bool` evaluaba `false` y toda capacidad se
   leía como OFF (`403 FEATURE_DISABLED`), incluso en registro con `waiters=true`. Se añadió
   `Json.AsBool` y `Json.DeserializeDict` normaliza a CLR (`ToClr`). (`Data/Json.cs`, `Auth/BusinessEndpoints`, `Common/Access.cs`)
5. **Escalada de rol efectivo:** `orders.own` faltaba en `All()` → la intersección
   owner∩waiter no coincidía con ningún rol y caía al fallback (owner) → un waiter podía editar
   productos (permiso concedido). Añadido `orders.own` a owner/admin. (`Common/Access.cs`)
6. **Owner como admin:** el registro creaba el device del owner con `role=admin`; la intersección
   owner∩admin = admin (∩ exacto) bloqueaba `backups` (solo owner). `Intersect` devuelve
   `membershipRole` cuando el device es `admin`/`owner`. (`Common/Access.cs`)
7. **Sincronizables con PK global:** catálogo/órdenes se identificaban por `id` global; dos negocios
   con `id=hamburguesa`/`cafe` colisionaban (violaba P.2 "PK por negocio"). PK compuesta
   `(business_id, id)` en `products`, `customers`, `providers`, `orders`. (`Data/VendeloDbContext.cs`)
8. Forma del contrato: push DTOs con `[JsonPropertyName]` snake_case; `DeserializeDict` de sync
   por `JsonObject`; `SyncRow` sin `sealed`; finders de catálogo tipados. (`Endpoints/*`, `Data/Models.cs`)

## 4. Auditoría contra BACKEND-F3-CONTRACT.md (§1 decisiones D1–D17)

| D | Decisión | Estado |
|---|---|---|
| D1 | Minimal API, JSON snake_case | ✔ (`[JsonPropertyName]`, `JsonNamingPolicy.CamelCase`) |
| D2 | EF Core 10, Npgsql PG / Sqlite tests por `Database:Provider` | ✔ |
| D3 | `seq` global por negocio como cursor | ✔ (`organization_sequence`, cursor `seq:N` en pull) |
| D4 | Tombstones (`deleted=true`+seq), sin DELETE físico | ✔ productos/clientes/proveedores; órdenes pendientes → voided |
| D5 | Ledger: stock = apertura + Σ movimientos; sobreventa flag, sin rechazo | ✔ (pay y sync paid) |
| D6 | Caja/cierres append-only; pago afecta caja abierta | ✔ |
| D7 | `invoiceNumber` secuencial por negocio, asignado una vez al pagar | ✔ (`business.NextOrderNumber` en transacción; `(business,number)` unique) |
| D8 | Auth: identifier email/teléfono, Argon2id, JWT 15 min + refresh 48 h/30 d hash | ✔ |
| D9 | Rol efectivo = membresía ∩ dispositivo; dispositivo no amplía | ✔ (corregido, ver §3.5–3.6) |
| D10 | Idempotencia `requestId` por negocio; reenvío → respuesta original | ✔ (`sync_batches ((business,request))` unique; test dedupe) |
| D11 | Bootstrap único: `opType='initial'` solo si negocio sin datos (sino 409); initial en incremental → 400 | ✔ |
| D12 | Multi-tenant `(business_id, …)` filtrado por token; ruta no amplía | ✔ (`AccessAsync`, claims `busid`/`dev`) |
| D13 | Capacidad OFF → `403 FEATURE_DISABLED` | ✔ (corregido §3.4) |
| D14 | `VERSION_MISMATCH` 409 con `details.current/expected` | ✔ (test) |
| D15 | Campos restaurante (orderType/waiter/table/prepStatus…) validados; anti-anónima; sin flujo cocina | ✔ (anti-anónima `400 anonymous_order`; edición post-envío 409) |
| D16 | `EnsureCreated` (migraciones/fases: F5) | ✔ |
| D17 | Config por env (`ConnectionStrings:Vendelo`, `Jwt__Key`, `Database:Provider`); dev-key local | ✔ |

Matriz de rutas (§3 y §4) contrastada: **todas las rutas del spec existen y pasan tests**:
`auth/register|login|refresh|session`, `accounts/recover` (placeholder), `businesses` CRUD,
`capabilities` GET/PATCH, `devices` POST/revoke, `products|customers|providers` CRUD,
`orders` POST/GET/PATCH/pay/void, `stock/{id}/adjust`, `cash/open|close/closures`,
`sync/pull|push`, `backups` GET/POST/DELETE/restore, `health`.

## 5. Anotaciones (GAPs / mejoras, ninguna bloqueante para F3)

- **No implementadas en F3 (por diseño del spec):** anulación post-pago `paid→voided` (F11); flujo
  cocina/kitchen endpoints (F8); SignalR (F10); `POST /auth/logout`, `/auth/change-password`,
  `/auth/me` (F4); `GET /orders/{id}` y `POST /orders/{id}/cancel` (F4/F11).
- **Paginación:** listados usan `Take` (500/200) sin cursor opaco `v1:` (P.21); el cursor de sync es
  `seq:N` (decisión F3 D3). Aceptable para la fase; paginar en F4.
- **`X-Device-Id`** (cabecera obligatoria P.3) no se valida: el dispositivo se toma del claim `dev`
  del JWT. Reforzar si el contrato lo exige.
- **`INVALID_CURSOR`:** un `since` con formato inválido se trata como delta desde 0 en vez de `400`.
- **Rate-limit** de auth/sync (P.5) pendiente → infra de despliegue (F5).
- **Backups:** snapshot/restore JSON server-side (spec §3); el multipart binario encriptado
  (P.18, "bytes opacos") se difiere a F5 ˗protected-1 substr.
- **Registro de `movementId`/`closureId`** con ids naturales del cliente: dedupe insert-if-absent
  correcto; el pago directo genera ids de servidor (`smv-…`) — coherente con P.4 "regla de PK".

## 6. Estado de los entregables F3

- Sin commits ni push (regla de la fase, ausencia de autorización). Backend listo en árbol de trabajo.
- Pendiente de **autorización para F3.1** (siguiente fase) antes de continuar.

## 7. Próximo paso (bloqueado)

- Actuar sobre las anotaciones de §5 y diseñar/planificar F3.1 solo tras autorización explícita del
  propietario. Sin autorización, la ejecución de F3 **termina con este informe**.