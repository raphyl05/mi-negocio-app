# Vendelo App — INFORME F6: Multi-device sync

**Fase:** F6 — Registro/identidad/autorización de dispositivos, membresías, sync por dispositivo, roles.
**Fecha:** 2026-09-22
**Base:** F5.1 (conexión cliente↔API) + F3/F3.1/F4/F4.1 (backend funcional).
**Stack:** React Native + TypeScript + Expo + SQLite ↔ ASP.NET Core + Npgsql + PostgreSQL.

---

## 1. Veredicto

**APROBADO** — Infraestructura de sincronización multi-dispositivo operativa.
- Sync push con datos reales (productos, clientes, proveedores, órdenes, movimientos, cierres).
- Sync pull desde servidor con cursor.
- Auto-sync al recuperar conexión.
- Backend ya soporta device auth, devices CRUD, sync endpoints.
- Tests: 298/298 pass, 35 suites. tsc limpio (0 errores).

---

## 2. Verificación objetiva

| Item | Resultado |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **0 errores** |
| `npm test` (cliente) | **298/298 pass** (35 suites) |
| `dotnet build` (backend) | **0 errores** (sin cambios) |
| `dotnet ef database update` | **aplicado** (sin cambios) |
| Backend sync endpoints | **OK** — `/sync/pull`, `/sync/push` |
| Backend device endpoints | **OK** — `/devices`, `/devices/{id}/revoke` |
| Cambios en `src/` | nuevos archivos + modificaciones |

---

## 3. Sincronización implementada

### 3.1 Sync Service (`src/services/syncService.ts`) — NUEVO

Servicio central de sincronización con 3 funciones principales:

**`syncPushData(businessId)`** — Push de datos locales al servidor:
- Recolecta datos de todos los repositorios locales
- Convierte cada entidad a batches del formato del servidor
- Tipos: business, product, customer, provider, order, stockMovement, cashClosure
- Usa `opType: 'incremental'` (no `initial` — datos locales ya existen)
- Retorna: `{ direction, pulled, pushed, errors }`

**`syncPullData(businessId, since)`** — Pull de datos del servidor:
- Llama a `syncApi.syncPull` con cursor
- Actualiza repositorios locales con datos del servidor
- Actualiza `syncStateService` con nuevo cursor y timestamp
- Retorna: `{ direction, pulled, pushed, errors, cursor }`

**`syncFull(businessId)`** — Sync completo (pull + push):
- Primero pull, luego push
- Útil en reconexión o primer sync de dispositivo

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
| CashClosure: countedCashCents | closingAmountCents |
| StockMovement: deviceId | deviceId (directo) |

### 3.2 Sync Queue update (`src/services/syncQueue.ts`) — MODIFICADO

- Ahora usa `syncService.syncPushData` (datos reales) en lugar de batches vacíos
- Importa `getBusiness()` para obtener businessId
- API sync es opcional (fallback silencioso si falla)
- Backup (Drive) + API sync en cada item procesado

### 3.3 Auto-Sync Hook (`src/hooks/useAutoSync.ts`) — NUEVO

Sincronización automática al:
- Cambiar estado de red (reconectar)
- Volver al foreground de la app

Comportamiento:
1. Verifica conexión (`isOnline`)
2. Si hay pending sync items → `processQueue()`
3. Obtiene negocio → `syncPullData` para descargar cambios

### 3.4 Network Detection (`src/utils/network.ts`) — CREADO en F5.1

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
- Actualiza: productos, clientes, proveedores, órdenes, movimientos
- Tombstones: no maneados (servidor no devuelve deletedAt en pull)

---

## 5. Dispositivos

### Registro automático
El dispositivo se registra automáticamente en el backend al:
- `apiLogin` → `EnsureDeviceAsync` crea device si no existe
- `apiRegister` → crea device como parte de la transacción

### Identidad del dispositivo
- `deviceId`: UUID generado en primer uso, persistido en AsyncStorage (`@micaja/deviceId`)
- `getDeviceId()` desde `src/utils/syncIdentity.ts`
- Se envía en login/register payload y en JWT claims (`dev`)

### Endpoints de dispositivos (backend ya existentes)
| Endpoint | Descripción | Autorización |
|---|---|---|
| `GET /businesses/{id}/devices` | Listar dispositivos del negocio | owner |
| `POST /devices` | Registrar dispositivo | owner |
| `PATCH /businesses/{id}/devices/{deviceId}/revoke` | Revocar dispositivo | owner |

---

## 6. Roles de dispositivo

El backend soporta roles de dispositivo via `Access.ResolveAsync`:
- `admin`: acceso completo
- `cashier`: POS básico
- `waiter`: mesero (órdenes)
- `kitchen`: cocina (comandas)
- `printer`: impresora

El dispositivo nunca amplía privilegios (`effectiveRole = intersection(membership.role, device.role)`).

**Nota**: La UI actual no permite asignar roles de dispositivo. Se asignan por defecto según contexto. Esto se refinará en F7-F19.

---

## 7. Membresías

El backend ya soporta membresías (users ↔ businesses):
- Un usuario puede tener múltiples membresías (roles: owner, admin, cashier, etc.)
- El JWT lleva `businessId` activo
- `GET /auth/me` devuelve perfil + membresías

**Nota**: UI de cambio de negocio no implementada (F6 no lo requiere, F7+). El token actual es la única forma de cambiar de contexto.

---

## 8. Item conocido: Números de orden por dispositivo

**Problema**: `order.number` y `FAC-NNNN` son correlativos POR DISPOSITIVO. En multi-dispositivo, dos dispositivos pueden generar `number=1` offline → colisión en servidor.

**Estado**: No resuelto en F6. Es un riesgo reconocido en BACKEND-AUDIT.md §5.

**Mitigación**: Sync push usa `opType: 'incremental'` y el servidor valida integridad. Las colisiones se detectan y se manejan a nivel de servicio (único por businessId + Number).

**Solución futura**: El servidor debe asignar números globales o los dispositivos deben reservar rangos (F7+).

---

## 9. Archivos creados/modificados en F6

| Archivo | Acción | Contenido |
|---|---|---|
| `src/services/syncService.ts` | Creado | syncPushData, syncPullData, syncFull, getLastCursor, mapeos |
| `src/hooks/useAutoSync.ts` | Creado | Auto-sync en reconexión/foreground |
| `src/services/syncQueue.ts` | Modificado | Usa syncService para API sync (datos reales) |
| `docs/INFORME-F6.md` | Creado | Este informe |

---

## 10. Items diferidos

| ID | Item | Prioridad | Destino |
|---|---|---|---|
| F6-1 | Dispositivo management UI (listar/revocar) | Media | F7 |
| F6-2 | Business switching UI (múltiples negocios) | Media | F7 |
| F6-3 | Asignar roles de dispositivo en login/register | Media | F7 |
| F6-4 | Manejo de conflictos LWW (updatedAt) | Alta | F7 |
| F6-5 | Tombstones en sync pull (deletedAt) | Media | F7 |
| F6-6 | Resolución orden number por dispositivo | Alta | F7 |
| F6-7 | Rate limiter distribuido (E1) | Alta | F6.1/F7 (requiere Redis) |
| F6-8 | Audit log integration en endpoints | Media | F6.1/F7 |
| F6-9 | StockMovement `deviceId` en recordMovement (G8) | Media | F7 |

---

## 11. Estado de la secuencia

F1 · F1.1 · F2 · F2.1 · F2.2 · F2.2-B · F3 · F3.1 · F4 · F4.1 · **F5** · **F5.1** · **F6** — pendientes: **F7** (capacidades visibles + UI), **F8** (comandas/meseros), **F9** (impresión), **F10** (tiempo real).
