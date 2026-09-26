# Vendelo App — INFORME F6: Multi-device sync

**Fase:** F6 — Registro/identidad/autorización de dispositivos, membresías, sync por dispositivo, roles.
**Fecha:** 2026-09-22 (refactor completado 2026-09-23; F6-1/2/3 UI completados 2026-09-23)
**Base:** F5.1 (conexión cliente↔API) + F3/F3.1/F4/F4.1 (backend funcional).
**Stack:** React Native + TypeScript + Expo + SQLite ↔ ASP.NET Core + Npgsql + PostgreSQL.

---

## 1. Veredicto

**APROBADO** — Infraestructura de sincronización multi-dispositivo operativa.
- Sync push con datos reales (productos, clientes, proveedores, órdenes, movimientos, cierres).
- Sync pull desde servidor con cursor.
- Auto-sync al recuperar conexión (reconexión o foreground).
- Backend ya soporta device auth, devices CRUD, sync endpoints.
- Tests: 341/341 pass (cliente, 39 suites) + 44/44 pass (backend). tsc limpio (0 errores). expo-doctor 21/21.

---

## 2. Verificación objetiva

| Item | Resultado |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **0 errores** |
| `npm test` (cliente) | **341/341 pass** (39 suites) |
| `dotnet build` (backend) | **0 errores** (warnings CS8604 preexistentes) |
| `dotnet test` (backend) | **44/44 pass** (40 + 4 nuevos de switch business/devices) |
| `npx expo-doctor` | **21/21 checks OK** |
| `dotnet ef migrations add OrderVoidFields` | aplicado (Npgsql, snapshot actualizado) |
| `dotnet ef migrations add DeviceCompositeKey` | aplicado (Npgsql: PK Devices global → compuesta `(BusinessId, Id)`) |
| Backend sync endpoints | **OK** — `/sync/pull`, `/sync/push` |
| Backend device endpoints | **OK** — `/devices`, `/devices/{id}/revoke` |
| Backend switch-business | **OK** — `POST /auth/switch-business` (re-emite sesión para otra membresía) |
| Cambios en `src/` | nuevos archivos + modificaciones |

---

## 2bis. Refactor F6 completado (2026-09-23)

Complementa F6 con los items de la auditoría que quedaron pendientes (tombstones, action delete, datos de pago/anulación en órdenes):

| Item | Estado |
|---|---|
| Cola real de cambios (`syncChangeQueue`) + toggle de tracking | ✅ implementado |
| Encolado de cambios en todos los repositorios (product, customer, provider, order, stockMovement, cashClosure) | ✅ implementado |
| `useAutoSync` reescrito (ensureSyncState + apiRegisterDevice + syncPushData + getLastCursor + syncPullData) | ✅ implementado |
| Push desde la cola real (no batch completo) con dedupe, chunking y limpieza por claves | ✅ implementado |
| Toggle de tracking off durante `applyPullChanges` (evita loop pull→enqueue) y en restore de backup | ✅ implementado |
| Backend: `action=delete` aceptado para product/customer/provider/order (soft delete + tombstone vía `Deleted`) | ✅ implementado |
| Backend: órdenes con `paidAt`/`voidedAt`/`voidReason` (pull y push) + transición paid→voided por sync | ✅ implementado |
| Migración `OrderVoidFields` (VoidedAt, VoidReason) | ✅ implementado |
| Tests nuevos: `syncChangeQueue` (12), `syncMapper` (~13) | ✅ implementado |

## 3. Sincronización implementada

### 3.1 Sync Service (`src/services/syncService.ts`) — NUEVO (refactorizado en F6.1)

Servicio central de sincronización:

**`syncPushData(businessId)`** — Push de cambios locales pendientes al servidor:
- Lee la cola real de cambios (`syncChangeQueue`)
- Convierte cada cambio pendiente a batches con `syncMapper` (type/action/id/entity)
- Tipos: business, product, customer, provider, order, stockMovement, cashClosure
- Dedupe por requestId + chunking; marca `synced` los movimientos de stock y limpia la cola por claves
- Acciones: `upsert` (payload completo) o `delete` (solo `{id}` → soft-delete en servidor)
- Retorna: `{ direction, pulled, pushed, errors }`

**`syncPullData(businessId, since)`** — Pull de cambios del servidor:
- Llama a `syncApi.syncPull` con cursor
- Aplica tombstones locales (productos/clientes/proveedores) y solapa órdenes/cierres (siempre gana el servidor)
- Desactiva el tracking (`setSyncTrackingEnabled(false)`) durante la aplicación para no re-encolar el pull
- Actualiza cursor/timestamp en `syncStateService`
- Retorna: `{ direction, pulled, pushed, errors, cursor }`

**`getLastCursor(businessId)`** — cursor `seq:N` desde `syncState` para el siguiente pull.

**Mapeo de campos** (cliente → servidor):
| Cliente | Servidor |
|---|---|
| Product: stockQuantity | openingStock |
| Product: category, emoji | (no mapeado — servidor no los usa en sync) |
| Customer: note | description |
| Provider: note | description |
| Order.items (snapshot Product) | items (productId, name, quantity, unitPriceCents, lineTotalCents) |
| Order: subtotalCents | totalCents |
| Order.customer.name | customerName |
| Order: paidAt/voidedAt/voidReason | paidAt/voidedAt/voidReason |
| CashClosure: countedCashCents | closingAmountCents |
| StockMovement: deviceId | deviceId (directo) |

### 3.2 Sync Change Queue (`src/services/syncChangeQueue.ts`) — NUEVO

Cola de cambios pendientes persistida en AsyncStorage (`@vendelo/syncChanges`):
- `enqueueSyncChange(type, id, action)` — coalesce por `type:id`; `delete` gana sobre `upsert`
- `setSyncTrackingEnabled(bool)` — toggle global (off durante pulls/restores para evitar loops)
- `listSyncChanges` / `countSyncChanges` / `dequeueSyncChanges(keys)` / `clearSyncChanges`
- Se alimenta desde los wrappers de repositorio (product/customer/provider/order/stockMovement) y desde `closeRegister` (cashClosure)

### 3.3 Auto-Sync Hook (`src/hooks/useAutoSync.ts`) — NUEVO (refactorizado en F6.1)

Sincronización automática al:
- Cambiar estado de red (reconectar)
- Volver al foreground de la app

Comportamiento:
1. `getBusiness()` → si no hay sesión/negocio, sale
2. Verifica conexión (`isOnline`) → si no, sale
3. `ensureSyncState(businessId)` (idempotente)
4. `apiRegisterDevice(businessId, 'admin')` (intentos, errores ignorados — no bloquea el sync)
5. `syncPushData(businessId)` → sube la cola pendiente
6. `getLastCursor(businessId)` → `syncPullData(businessId, cursor)`
7. Notifica al usuario (éxito con cantidades o error) vía `useNotifications`

Estados del hook: idle / syncing / error, con desbloqueo por mención explícita en la UI.

### 3.4 Sync Mapper (`src/utils/syncMapper.ts`) — NUEVO

Mapeos puros cliente↔servidor (push `buildXBatch` y pull `xFromServer`), incluidos tombstones (`deletedAtOf`), stock movements normalizados y campos `paidAt/voidedAt/voidReason` de órdenes.

### 3.5 Network Detection (`src/utils/network.ts`) — CREADO en F5.1

- `isOnline()`: `Promise<boolean>` via `@react-native-community/netinfo`

---

## 4. Flujo de sincronización

```
┌──────────────────────────────────────────────────────────┐
│ Evento: reconexión / foreground                          │
├──────────────────────────────────────────────────────────┤
│ useAutoSync                                              │
│  1. isOnline()?                                          │
│     ├─ No → salir                                        │
│     └─ Sí ↓                                              │
│  2. getPendingCount() > 0?                               │
│     ├─ Sí → processQueue()                               │
│     │   ├─ Drive backup (por pending item)               │
│     │   └─ API sync push (datos reales via syncService)  │
│     └─ No → continuar                                    │
│  3. getBusiness()                                        │
│     └─ Sí → syncPullData(businessId)                     │
│         ├─ GET /sync/pull?since=<cursor>                 │
│         ├─ Actualizar repositorios locales               │
│         └─ Actualizar syncState (cursor, timestamp)      │
└──────────────────────────────────────────────────────────┘
```

### Sync push (datos locales → servidor):

| Entidad | Batch type | Campos enviados |
|---|---|---|
| Business | `business` | id, name, ownerName |
| Products | `product` | id, name, priceCents, openingStock, active |
| Customers | `customer` | id, name, phone, address, description |
| Providers | `provider` | id, name, phone, address, description |
| Orders | `order` | id, status, items, totalCents, paymentMethod, customer |
| StockMovements | `stockMovement` | id, productId, movementType, quantity, deviceId |
| CashClosures | `cashClosure` | id, openingAmountCents, expectedCents, closingAmountCents, differenceCents |

### Sync pull (servidor → locales):

- Cursor: `lastServerCursor` en `syncState` (formato `seq:N` del servidor)
- Actualiza: productos, clientes, proveedores, órdenes, movimientos y cierres
- Tombstones: **manejados** — `deletedAt = updatedAt` derivado de `deleted` en pull; en push, `action=delete` marca `Deleted=true` en el servidor (soft delete) para que todos los dispositivos lo reciban vía pull

---

## 5. Dispositivos

### Registro automático
El dispositivo se registra automáticamente en el backend al:
- `apiLogin` → `EnsureDeviceAsync` crea device si no existe
- `apiRegister` → crea device como parte de la transacción

### Identidad del dispositivo
- `deviceId`: UUID generado en primer uso, persistido en AsyncStorage (`@vendelo/deviceId`)
- `getDeviceId()` desde `src/utils/syncIdentity.ts`
- Se envía en login/register payload y en JWT claims (`dev`)

### Endpoints de dispositivos (backend ya existentes)
| Endpoint | Descripción | Autorización |
|---|---|---|
| `GET /businesses/{id}/devices` | Listar dispositivos del negocio | owner |
| `POST /devices` | Registrar dispositivo | owner |
| `PATCH /businesses/{id}/devices/{deviceId}/revoke` | Revocar dispositivo | owner |

### Gestión de dispositivos en la app (F6-1 — resuelto)
- **`DevicesScreen`** (`src/screens/settings/DevicesScreen.tsx`): lista dispositivos del negocio activo con rol, estado Activo/Revocado y badge "ESTE EQUIPO" (vía `getDeviceId`).
- Revocar con confirmación (`Alert`) → `PATCH /businesses/{id}/devices/{deviceId}/revoke`, pull-to-refresh.
- Acceso desde `SettingsScreen` → CONFIGURACIÓN → "Dispositivos".
- Rutas `Devices` registradas en `RootNavigator`.

---

## 6. Roles de dispositivo

El backend soporta roles de dispositivo via `Access.ResolveAsync`:
- `admin`: acceso completo
- `cashier`: POS básico
- `waiter`: mesero (órdenes)
- `kitchen`: cocina (comandas)
- `printer`: impresora

El dispositivo nunca amplía privilegios (`effectiveRole = intersection(membership.role, device.role)`).

### Asignación de rol en login (F6-3 — resuelto)
- La pantalla de login (`LoginScreen.tsx`) incluye un selector de rol (admin / cajero / mesero / cocina / impresora / "sin rol").
- El rol elegido se envía como `deviceRole` en el body de `/auth/login` y `/auth/register` (`LoginRequestDto.deviceRole`).
- Backend: `EnsureDeviceAsync` valida contra `Roles.All` y lo aplica tanto a devices nuevos como a devices existentes en esa empresa.
- `useAutoSync` sigue registrando con `'admin'` de forma idempotente (el servidor responde 409 si el device ya existe, así que **no** sobrescribe el rol elegido en login).

---

## 7. Membresías

El backend ya soporta membresías (users ↔ businesses):
- Un usuario puede tener múltiples membresías (roles: owner, admin, cashier, etc.)
- El JWT lleva `businessId` activo
- `GET /auth/me` devuelve perfil + membresías

### Cambio de negocio (F6-2 — resuelto)
- **Backend**: nuevo `POST /auth/switch-business` (`SwitchBusinessRequestDto { businessId?, deviceName? }`). Valida membresía activa del usuario para el negocio pedido, asegura el device **creándolo en el negocio destino** y re-emite access/refresh tokens con la nueva membresía (`SessionPayloadAsync` con todos los negocios del usuario).
- **PK de Devices cambiada** a compuesta `(BusinessId, Id)` (migración `DeviceCompositeKey`): un mismo equipo físico puede ahora registrarse en varios negocios. Antes era PK global y el switch fallaba con `UNIQUE constraint failed: Devices.Id`.
- **Refresh multi-negocio**: `/auth/refresh` acepta `businessId` opcional en el body para conservar el negocio activo al rotar tokens.
- **Cliente**: `AuthContext` persiste `activeBusinessId` en SecureStore (`saveActiveBusinessId`), se restaura al arrancar y se manda en refrescos (`apiRefresh`/`tryRefresh`).
- **`BusinessSwitcherScreen`** (`src/screens/settings/BusinessSwitcherScreen.tsx`): lista `session.businesses`, resalta el activo y llama `switchBusiness(businessId)`.
- Acceso desde `SettingsScreen` → CONFIGURACIÓN → "Cambiar de negocio". Rutas `BusinessSwitcher` registradas en `RootNavigator`.
- Las pantallas que usaban `session.businesses[0]?.id` ahora usan `session?.activeBusinessId ?? session?.businesses[0]?.id ?? ''` (`DatosYRespaldoScreen`, `ConfigurationScreen`, `KitchenScreen`, `InvoiceScreen`, `AuthContext`).
- Tests: `SwitchBusinessAndDevicesTests.cs` (4): rol de device vía `deviceRole` en login, switch emite tokens y negocios esperados, 403 sin membresía, 400 sin businessId.

---

## 8. Item conocido: Números de orden por dispositivo

**Problema**: `order.number` y `FAC-NNNN` son correlativos POR DISPOSITIVO. En multi-dispositivo, dos dispositivos pueden generar `number=1` offline → colisión en servidor.

**Estado**: Mitigado — el servidor asigna `order.number` globalmente cuando un sync marca la orden como pagada con `Number <= 0` (`business.NextOrderNumber`). Las órdenes pagadas offline llegan sin número y el servidor las numerifica en orden de llegada. El caso de dos pagos offline simultáneos que llegan con su propio número sigue pendiente de resolución definitiva (versión futura).

**Mitigación**: Sync push usa `opType: 'incremental'` y el servidor valida integridad. Las colisiones se detectan y se manejan a nivel de servicio (único por businessId + Number).

**Solución futura**: El servidor debe asignar números globales o los dispositivos deben reservar rangos (F7+).

---

## 9. Archivos creados/modificados en F6 (+ refactor F6.1)

| Archivo | Acción | Contenido |
|---|---|---|
| `src/services/syncService.ts` | Creado/modificado | syncPushData (cola real), syncPullData (cursor+tombstones), getLastCursor, applyPullChanges con tracking off, markSynced |
| `src/services/syncChangeQueue.ts` | Creado (F6.1) | Cola AsyncStorage + toggle de tracking + coalesce |
| `src/utils/syncMapper.ts` | Creado (F6.1) | Mapeos push/pull, tombstones, paid/void |
| `src/services/cashRegisterService.ts` | Modificado (F6.1) | `upsertCashClosureRecord` + enqueue en `closeRegister` |
| `src/services/backupService.ts` | Modificado (F6.1) | tracking off + clearSyncChanges al restaurar; limpieza al borrar cuenta |
| `src/repositories/{product,customer,provider,order,stockMovement}Repository.ts` | Modificados (F6.1) | enqueueSyncChange en wrappers |
| `src/hooks/useAutoSync.ts` | Creado/modificado | ensureSyncState + register + push + pull(cursor) |
| `App.tsx` | Modificado (F6.1) | SyncEngine montado con sesión |
| `backend/.../Endpoints/SyncEndpoints.cs` | Modificado (F6.1) | action delete (product/customer/provider/order), paid/void en orders, OrderPushDto extendido |
| `backend/.../Endpoints/OrderEndpoints.cs` | Modificado (F6.1) | VoidAsync setea VoidedAt |
| `backend/.../Endpoints/BusinessEndpoints.cs` | Modificado (F6.1) | snapshot restore mapea VoidedAt/VoidReason |
| `backend/.../Data/Models.cs` | Modificado (F6.1) | Order.VoidedAt / Order.VoidReason |
| `backend/.../Common/Dtos.cs` | Modificado (F6.1) | OrderDto + push DTOs con voidedAt/voidReason |
| `backend/.../Migrations/2026..._OrderVoidFields.cs` | Creado (F6.1) | Migración Npgsql de columnas void |
| `__tests__/syncChangeQueue.test.ts`, `__tests__/syncMapper.test.ts` | Creados (F6.1) | 25 tests nuevos |
| `jest.setup.js` + `package.json` | Creados/modificado (F6.1) | mock global AsyncStorage para jest |
| `docs/INFORME-F6.md` | Creado | Este informe |
| `src/services/authApi.ts` | Modificado (F6.1.x) | `businesses` en login/register, `apiListDevices`, `apiRevokeDevice`, `apiSwitchBusiness`, `businessId` en refresh, persistencia de `activeBusinessId` |
| `src/contexts/AuthContext.tsx` | Modificado (F6.1.x) | `activeBusinessId`, `switchBusiness`, restore respeta negocio persistido |
| `src/screens/settings/DevicesScreen.tsx` | Creado (F6.1.x) | F6-1: listar/revocar dispositivos |
| `src/screens/settings/BusinessSwitcherScreen.tsx` | Creado (F6.1.x) | F6-2: cambio de negocio |
| `src/screens/login/LoginScreen.tsx` | Modificado (F6.1.x) | F6-3: selector de rol de dispositivo |
| `src/navigation/types.ts`, `src/navigation/RootNavigator.tsx` | Modificados (F6.1.x) | rutas `Devices` y `BusinessSwitcher` |
| `backend/.../Common/Dtos.cs` | Modificado (F6.1.x) | `LoginRequestDto.deviceRole`, `SwitchBusinessRequestDto`, `RefreshRequestDto.businessId` |
| `backend/.../Data/VendeloDbContext.cs` | Modificado (F6.1.x) | PK compuesta de Devices `(BusinessId, Id)` |
| `backend/.../Migrations/20260923144742_DeviceCompositeKey.cs` | Creado (F6.1.x) | migración Npgsql del cambio de PK |
| `backend/.../Endpoints/AuthEndpoints.cs` | Modificado (F6.1.x) | `POST /auth/switch-business`, `deviceRole` en login, refresh por businessId |
| `backend/tests/.../SwitchBusinessAndDevicesTests.cs` | Creado (F6.1.x) | 4 tests de switch business + device roles |

---

## 10. Items diferidos

| ID | Item | Prioridad | Destino |
|---|---|---|---|
| ~~F6-4~~ | ~~Manejo de conflictos LWW (updatedAt)~~ | ~~Alta~~ | ✓ resuelto (server wins en pull) |
| ~~F6-5~~ | ~~Tombstones en sync pull (deletedAt)~~ | ~~Media~~ | ✓ resuelto (action delete + deletedAt derivado) |
| ~~F6-6~~ | ~~Resolución orden number por dispositivo~~ | ~~Alta~~ | ✓ mitigado (numeración server-side al pagar) |
| ~~F6-9~~ | ~~StockMovement `deviceId` en recordMovement~~ | ~~Media~~ | ✓ resuelto (ledger envía deviceId) |
| ~~F6-1~~ | ~~Dispositivo management UI (listar/revocar)~~ | Media | ✓ resuelto (DevicesScreen) |
| ~~F6-2~~ | ~~Business switching UI (múltiples negocios)~~ | Media | ✓ resuelto (BusinessSwitcherScreen + POST /auth/switch-business) |
| ~~F6-3~~ | ~~Asignar roles de dispositivo en login/register~~ | Media | ✓ resuelto (selector en LoginScreen + deviceRole) |
| F6-7 | Rate limiter distribuido (E1) | Alta | F6.1/F7 (requiere Redis) |
| F6-8 | Audit log integration en endpoints | Media | F6.1/F7 |

---

## 11. Estado de la secuencia

F1 · F1.1 · F2 · F2.1 · F2.2 · F2.2-B · F3 · F3.1 · F4 · F4.1 · **F5** · **F5.1** · **F6** — pendientes: **F7** (capacidades visibles + UI), **F8** (comandas/meseros), **F9** (impresión), **F10** (tiempo real).
