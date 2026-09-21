# Vendelo App — F3: Backend Source of Truth (Análisis)

> FASE **F3** — ANÁLISIS. Documento de mapeo del contrato → implementación.
> Fuentes: `docs/API-CONTRACT.md` (49 PARTES, integración F2.2/F2.2-B), `docs/SYNC-STRATEGY.md`,
> `docs/CONTRACT-AUDIT.md` (cierre), `docs/BACKEND.md`.
> Stack decidido: **ASP.NET Core (Minimal API, net10.0) + EF Core 10 + PostgreSQL 17 (+ Sqlite in-memory en tests)**.

## 1. Decisiones de arquitectura (F3)

| # | Decisión |
|---|---|
| D1 | API **Minimal API** (sin Controllers), JSON `snake_case` compatible con los ejemplos del contrato. |
| D2 | **EF Core 10**. Provedor real `Npgsql` (PostgreSQL 17); en tests `Sqlite` in-memory (semántica relacional real: unicidades, transacciones). Selección por config `Database:Provider`. |
| D3 | **Modelo de datos único por negocio + secuencia global** (`organization_sequence`): cada fila sincronizable lleva `seq` (bigint) asignada al escribir; `seq` es el cursor idempotente de sincronización. |
| D4 | **Tombstones**: borrado = `deleted=true` + `seq` (P.16/P.31). No DELETE físico en sincronizables. |
| D5 | **Ledger de inventario** (P.12): stock = apertura + Σ movimientos; nunca se rechaza una venta pagada; sobreventa se **flaggea** (`order.overventa` y agregado por cierre). Sin replay de snapshots. |
| D6 | **Caja/cierres append-only** (P.13): cerrar caja siempre crea un registro nuevo; los pagos modifican la caja abierta vigente; sin LWW. |
| D7 | **invoiceNumber** secuencial por negocio asignado **una vez** por el servidor al pagar (P.11.1–11.3); el cliente lo omite. |
| D8 | **Auth** (P.5 / 32.7): `identifier` = email O teléfono; Argon2id (Isopoh) server-side; JWT acceso 15 min (`role`=membresía, `busid`, `dev`) + refresh opaco rotativo 48 h (hash en BD, caducidad 30 días). `changeEpoch` invalida sesiones. |
| D9 | **Rol efectivo** = membresía ∩ dispositivo (P.41.5): matriz de permisos; el dispositivo **nunca** amplía. Dispositivo sin rol ⇒ herencia de membresía (compat). |
| D10 | **Idempotencia por `requestId`** (P.4/P.31): `sync_batches((business_id, request_id))` UNIQUE; reenvío → respuesta original sin re-aplicar. |
| D11 | **Bootstrap único** (M1/P.25): sin `/sync/initial`; `opType='initial'` solo vía push, solo si **no hay datos previos** del negocio (si no → `409 CONFLICT`); `opType='initial'` en batch incremental → `400`. |
| D12 | **Multi-tenant**: todos los módulos sincronizables filtran por membresía `(business_id, …)` (P.22#6). El `businessId` del token es la autoridad; las rutas no elevan el alcance. |
| D13 | **Capabilities OFF** ⇒ `403 FEATURE_DISABLED` en operaciones que las requieren (P.40.6). |
| D14 | `VERSION_MISMATCH` (409) ante `expectedCapabilityVersion` desactualizado (P.6.2/34). |
| D15 | **Restaurante** (F8): campos opcionales `orderType/waiterId/waiterName/tableId/tableName/customerId/prepStatus/kitchenTicketId` soportados y validados ahora (anti-anónima + edición post-envío 409), sin implementar flujo de cocina. |
| D16 | Migraciones EF: `EnsureCreated` para F3 (fase de desarrollo); el pipeline de migraciones + seed de producción se genera en F5 (despliegue). |
| D17 | Config por env vars (`ConnectionStrings:Vendelo`, `Jwt__Key`, `Database__Provider`). Sin secretos en el repo (clave JWT por variable de entorno; en `Development` fallback local). |

## 2. Modelo de datos (mapeo PARTE → tabla)

| Tabla | Contrato | Notas |
|---|---|---|
| `users` (no sincroniza) | P.3/5/32.7 | id, username, email (unique), phone (unique), password_hash (Argon2id), change_epoch, created_at |
| `memberships` | P.6/41.2 | (user_id, business_id) unique, role (`owner admin cashier waiter kitchen printer`), active, created_at |
| `businesses` | P.6.1/40 | id opaco, name, owner_name, business_type, capabilities (JSON), settings (JSON), capability_version, created_at, updated_at |
| `devices` | P.7/41.5 | id (deviceId local está por instalación), business_id, name, role nullable, active, registered_at |
| `device_sessions` | P.5.1 | id, device_id, user_id, refresh_token_hash, active, created_at, expires_at (48h), absolute_expires_at (30d) |
| `organization_sequence` | P.14 | business_id PK, next_seq |
| `sync_batches` | P.15/31 | (business_id, request_id) PK, op_type, applied_seq, applied_at, response (JSON), unique |
| `products` | P.9/12/16 | id, business_id, name, price_cents, opening_stock, active, seq, deleted, created/updated_at |
| `customers` / `providers` | P.2 | id, business_id, name, phone, address, description, seq, deleted, created/updated_at |
| `orders` | P.10/11/42/44/45 | id, business_id, number, status (`pending paid voided`), prep_status (`new sent preparing ready served`), order_type, waiter_id/name, table_id/name, customer_id/name, items JSON, events JSON, total/received/change cents, payment_method, overventa, seq, deleted, created/paid/updated_at |
| `stock_movements` | P.12/31 | id, business_id, product_id, movement_type (`opening purchase sale adjustment void`), quantity, amount_cents, order_id nullable, device_id, seq, created_at; **append-only** |
| `cash_register` (vigente) | P.13/31 | business_id, id, opening_amount_cents, opened_at, state (`open closed`) |
| `cash_closures` | P.13 | id, business_id, expected_cents, closing_amount_cents, difference_cents, sales_by_method JSON, seq, closed_at; **append-only** |
| `backups` | P.18 | id, business_id, created_at, payload (JSON de snapshot), seq |

Restricciones clave: `sync_batches` UNIQUE (business_id, request_id); `memberships` UNIQUE (user_id, business_id);
`users.email`/`users.phone` UNIQUE; `orders.number` sube único por negocio con asignación en transacción (secuencial).

## 3. Tabla de rutas (módulo ↔ PARTE)

| Ruta | PARTE | Rol mínimo efectivo | Notas |
|---|---|---|---|
| `POST /api/v1/auth/register` | 32.7/6.1 | público | transacción cuenta+negocio+owner+dispositivo+sessión; idempotente |
| `POST /api/v1/auth/login` | 32.1 | público | 401 genérico; crea dispositivo si hace falta |
| `POST /api/v1/auth/refresh` | 32.2 | público | rotación, 401 si inválido, 403 si duplicado/reusado |
| `GET /api/v1/auth/session` | 32.3 | autenticado | valida el par (acceso+refresh del token) |
| `POST /api/v1/accounts/recover` | 32.6 | público | placeholder genérico (Ver PARTE 20) |
| `GET /api/v1/businesses` | 6.1 | autenticado | lista básica |
| `POST /api/v1/businesses` | 6.1/32.8 | autenticado | nuevo negocio (owner) |
| `GET /api/v1/businesses/{id}` | 6.1/40 | miembro | 404 si no miembro |
| `PATCH /api/v1/businesses/{id}` | 6.1 | owner/admin | metadatos no-sensibles; sube capability_version si aplica |
| `GET/PATCH /api/v1/businesses/{id}/capabilities` | 6.2/32.9 | GET: miembro; PATCH: owner/admin | PATCH con `expectedCapabilityVersion` → 409 VERSION_MISMATCH |
| `POST /api/v1/devices` / `PATCH .../devices/{id}/revoke` | 7 | owner/admin | alta y revocación |
| `GET/POST/PUT/DELETE /api/v1/businesses/{id}/products\|customers\|providers` | 9/16/30 | cashier+ | CRUD sincronizable con seq |
| `POST /api/v1/businesses/{id}/orders` | 10/42 | cashier/waiter | anti-anónima si waiter; edición post-envío guard |
| `POST /api/v1/businesses/{id}/orders/{oid}/pay` | 11/12 | cashier+ | invoiceNumber; movimientos; sobreventa flag |
| `POST /api/v1/businesses/{id}/orders/{oid}/void` | 11 | cashier+ | solo pending en F3 (anulaciones post-pago: F11) |
| `GET /api/v1/businesses/{id}/orders` | 30 | miembro | lectura |
| `POST /api/v1/businesses/{id}/stock/{pid}/adjust` | 12 | admin/owner | compra/ajuste → movimiento |
| `POST /api/v1/businesses/{id}/cash/open\|close`; `GET .../cash/closures` | 13 | admin | append-only |
| `GET /api/v1/businesses/{id}/sync/pull?since=` | 14/25 | miembro | snapshot o delta; cursor `seq` |
| `POST /api/v1/businesses/{id}/sync/push` | 15/25 | miembro | dedupe requestId; opType initial/incremental |
| `GET/POST/DELETE /api/v1/businesses/{id}/backups` | 18 | owner/admin | snapshot/restore |
| `GET /api/v1/health` | — | público | estado + db |

## 4. Matriz de permisos (P.41.3) implementada

```
                  owner admin cashier waiter kitchen printer
products CRUD      ✔     ✔     ✔     -      -       -
orders create/pay  ✔     ✔     ✔     ✔      -       -
orders read        ✔     ✔     ✔     ✔      ✔(kitchen) ✔
kitchen-status     ✔     ✔     -      -      ✔       -
tables             ✔     ✔     -      ✔      -       -
membresías/devices ✔     ✔     -      -      -       -
capabilities       ✔     ✔     -      -      -       -
cierre caja        ✔     ✔     -      -      -       -
backups            ✔     ✔     -      -      -       -
```

Rol efectivo = `min(permissions(membership.role), permissions(device.role))` con herencia cuando
`device.role` es null (`*`).

## 5. GAPs / notas para F3.1 y fases siguientes
- Anulación post-pago (deshacer/rehacer ventas, P.11) → F11 (reconciliación completa).
- Flujo cocina/kitchen endpoints → F8; SignalR → F10.
- Migraciones EF + deploy de PostgreSQL → F5 (despliegue).
- Registro de email/teléfono en la app (G13) → F4.
- Cambio de contraseña/login OTP → F4.

## 6. Verificación objetivo
- `dotnet build` limpio; `dotnet test` integración (auth, register transacción, VERSION_MISMATCH,
  dedupe sync, initial+restore, sobreventa, rol efectivo).
- App cliente intacta: `npm test` (35 suites / 298) y `tsc --noEmit` sin cambios.