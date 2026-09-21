# Vendelo App — INFORME F3.1: Auditoría del Backend

> **Fase:** F3.1 — AUDITORÍA (solo lectura + verificación, sin cambios de código).
> Alcance (API-CONTRACT.md, PARTE 38): estructura, PostgreSQL, migraciones, índices,
> transacciones, errores, CORS. Fuente: `backend/` F3 + `docs/BACKEND-F3-CONTRACT.md` (D1–D17).
> Fecha: 2026-09-21.

## 1. Veredicto

**APROBADO CON ANOTACIONES.** — Las 7 dimensiones auditadas están correctas o con anotaciones no
bloqueantes (§5). Build 0 errores, 27/27 tests de integración en verde, y el modelo EF genera DDL
PostgreSQL válido (validado offline mediante `dotnet ef dbcontext script`, sin conexión en vivo).
Sin commits, sin push, `src/` del cliente intacto.

## 2. Verificación objetiva

| Ítem | Resultado |
|---|---|
| `dotnet build Vendelo.slnx -t:Rebuild` | **0 errores**; 15 warnings CS8604 (nullability `deviceId` → `ResolveAsync`; 1 de `DeserializeDict`) benignos |
| `dotnet test Vendelo.slnx --no-build` | **27/27 pass** (SQLite, 17 s) |
| `dotnet ef dbcontext script` (Npgsql) | DDL generado sin errores: 15 tablas + 20 índices/unicidad (263 líneas) |
| Herramientas | `dotnet-ef` 10.0.0 instalado (>= runtime 10.0.12 recomendado); `Microsoft.EntityFrameworkCore.Design` 10.0.12 en proyecto |
| Cambios | ninguno en código (auditoría) |

## 3. Auditoría por dimensión

### 3.1 Estructura
- Layout limpio: `src/Vendelo.Api/{Endpoints, Data, Auth, Common}` + `tests/Vendelo.Api.Tests/{AuthFlowTests, CatalogAndAccessTests, OrderAndSyncTests, TestSupport}`; `Vendelo.slnx` con 2 proyectos.
- Minimal API **net10.0**, JSON snake_case vía `[JsonPropertyName]` (coherente con contrato).
- Paquetes: JwtBearer 10.0.12, OpenApi 10.0.12, EF Core 10.0.12 (+Design), Npgsql 10.0.3, Sqlite, Isopoh Argon2 2.0.0; tests: xunit 2.9.3 + Mvc.Testing 10.0.12.
- DI correcta: `VendeloDbContext` por proveedor (`Database:Provider`), `TokenService` singleton, `AccessService` scoped; JWT configurado (`ValidateIssuerSigningKey/Issuer/Audience/Lifetime`, ClockSkew 30 s).
- Ojo: `dotnet-ef` global desactualizado (10.0.0 vs runtime 10.0.12) → `dotnet tool update -g dotnet-ef`.

### 3.2 PostgreSQL
- Provider Npgsql por defecto (fallback `Host=localhost;Database=vendelo;...` o `ConnectionStrings:Vendelo`). D17 respetado: override por env, sin secretos en el repo; dev-key JWT solo en Development.
- **Modelo → DDL Npgsql validado offline** sin errores: tipos correctos (`character varying(64/120/255)` para ids/nombres, `timestamp with time zone` para timestamps, `bigint` para dinero/`seq`/`number`), PKs simples y compuestas, 20 índices/unicidad (ver 3.4).
- **Conexión en vivo NO probada** (credenciales locales desconocidas; decisión del propietario en esta auditoría). Pendiente para F5: definir cadena de conexión real y ejecutar `EnsureCreated`/migración en un servidor objetivo.

### 3.3 Migraciones
- F3 usa por diseño **`EnsureCreated`** (D16) — se confirmó que crea el esquema completo (mismo DDL validado en 3.2).
- Plan para F5 (no ejecutar en F3.1, si no se solicita): `dotnet ef migrations add InitialCreate`, pipeline `db.Database.Migrate()` + seed, y renombrar esquema a snake_case/plural si el contrato lo exige (hoy las tablas salen `"Products"`, etc.).

### 3.4 Índices
Cobertura correcta para sync y unicidad:
- Deltas de sync: `(BusinessId, Seq)` en products/customers/providers/orders/stock_movements/cash_closures ✔
- Unicidad: `Users.Email`, `Users.Phone`; `Memberships(UserId,BusinessId)`; `Devices(BusinessId,Id)`; `Orders(BusinessId,Number)`; `Backups(BusinessId,Id)`; PK `SyncBatches(BusinessId,RequestId)` ✔
- Listados: `(BusinessId, UpdatedAt)` en products/customers/providers; `Orders(BusinessId,Status)` ✔
- **GAPs (anotación, resolver en F5):**
  1. `StockMovements` no tiene `(BusinessId, ProductId)`: el agregado `SumAsync(Quantity)` por producto en `pay`/`push` hará barrido por negocio. Añadir índice en la migración F5.
  2. `DeviceSessions` solo indexa `RefreshTokenHash`; la revocación masiva filtra `(DeviceId, Active)` → índice opcional.
  3. Snapshot pull (Modo A) consulta el negocio completo sin paginar; aceptable en escala F3, revisar en F5/F7.

### 3.5 Transacciones
- Cada operación multi-entidad usa **un único `SaveChangesAsync`** → transacción implícita atómica: `register` (user+business+membership+device+seq), `pay` (order+movements+invoice+seq), `cash/close` (closure+register), `sync/push` (rows+seq+sync_batch), `restore` (delete+insert — ver anotación).
- **Anotación concurrencia (no bloqueante en F3; relevante en F6 multi-dispositivo):** `NextSeqAsync` y `NextOrderNumber` son *read-increment* sin bloqueo de fila. Dos pays concurrentes al mismo negocio podrían obtener el mismo `seq` (detección silenciosa) o mismo `invoiceNumber` (el UNIQUE `(BusinessId,Number)` aceptaría uno y el otro fallaría — detectable como 500). Mitigación para F5: reserva atómica `UPDATE … RETURNING` dentro de la transacción.
- Anotación: `register` hace 2 `SaveChanges` (cuenta+negocio, luego sesión); reintentar crearía una sesión extra inocua. `restore` usa 2 `SaveChanges` → envolver en una transacción única en F5.

### 3.6 Errores
- `ApiErrorHandlingMiddleware` (+ `AppException`): envelope `{error:{code,message,requestId,details}}`; excepciones inesperadas → `500 INTERNAL_ERROR` con `details=null` (sin leaks de stack al cliente); errores de dominio bien mapeados: 401 genérico (`UNAUTHORIZED`), 403 (`FORBIDDEN`/`FEATURE_DISABLED`), 404 (`NOT_FOUND`), 409 (`CONFLICT`, `VERSION_MISMATCH` con `current/expected`, `INVALID_STATE`, `anonymous_order`), 400 (`VALIDATION_ERROR`).
- Anotaciones: el 500 se loguea con `Console.Error`, no con `ILogger` (para F4.1); `var scope = ctx.RequestServices.CreateAsyncScope(); scope.Dispose();` en el catch es código vacío (cosmético, limpiar).

### 3.7 CORS
- **No configurado** (`AddCors`/`UseCors` ausentes). Correcto para el cliente nativo React Native (sin navegador ni preflight). Anotación: requerido solo si aparece web/admin o el hub SignalR (F10); mientras tanto `AllowedHosts: "*"` debe restringirse en F5.

## 4. Evidencia clave (referencias)
- `Program.cs:15-23` proveedor/connstring; `:25-47` JWT; `:68-72` EnsureCreated.
- `Data/VendeloDbContext.cs:26-155` entidades/índices; `:149-155` value-converter `DateTimeOffset→DateTime UTC` (requisito SQLite + PG).
- `Endpoints/OrderEndpoints.cs:138-208` (pay: invoice + movimientos + overventa), `:257-313` (cash open/close).
- `Endpoints/SyncEndpoints.cs:30-157` (pull cursor `seq:N`; push dedupe requestId); `:158-368` (upserts, append-only, tombstone).
- `Endpoints/BusinessEndpoints.cs:323-435` (restore snapshot en 2 SaveChanges).
- `Common/Access.cs:16-44,77-89` (matriz permisos, Intersección rol efectivo, RequireCapability).

## 5. Anotaciones (ninguna bloqueante para F3.1 → mayormente F5)
1. **PG en vivo sin validar** (credenciales locales; decisión del propietario). Configurar connstring por env y smoke-test en F5.
2. **Concurrencia `seq`/`invoiceNumber`** (read-increment) → reserva `UPDATE … RETURNING` en F5.
3. **Índice `StockMovements(BusinessId, ProductId)`** para el ledger de stock.
4. **`restore` en 2 SaveChanges** → transacción única.
5. **`dotnet-ef` global 10.0.0** → actualizar a 10.0.12.
6. **CORS ausente** (correcto hoy) y **`AllowedHosts: "*"`** → endurecer en F5.
7. **Logging 500 por `Console.Error`** y scope no usado en middleware → `ILogger` (F4.1).

## 6. Conclusión
La auditoría F3.1 confirma que el backend F3 es sólido (estructura coherente, modelo validado para
PostgreSQL, índices/unicidad correctos, transacciones atómicas por operación, manejo de errores sin
leaks, sin CORS innecesario). Las anotaciones se difieren a F5/F4.1/F6. **F3.1 queda aprobada.
Sin commits ni push. Siguiente fase (F4 o F4.1) solo con autorización explícita.**