# Vendelo App — Contrato de API (FASE 2 / F2.2 — diseño, no implementado)

> **Fase:** 2 — DISEÑO SOLO. Este documento **no** implica ninguna implementación, ni en la app
> (React Native + TypeScript + Expo + SQLite) ni en el backend (ASP.NET Core + PostgreSQL).
> Es la **especificación de contrato** que deberá implementar el backend en F3 y el motor de sync
> en F4. Todo lo que aquí se declara "pendiente de fase futura" queda **explícitamente sin implementar**.
>
> **Reglas de esta fase:** solo lectura de código + diseño + documentación. NO se creó backend,
> NO se instalaron paquetes (ni .NET ni npm), NO se modificaron modelos/repositorios/servicios/
> pantallas/autenticación/backup/SQLite, NO se hizo commit ni push.
>
> **F2.2 (integración C1–C14 de `docs/CAPABILITIES-AUDIT.md`):** este contrato incorpora el modelo
> de **capacidades del negocio** (`businessType` + `capabilities` + `settings` + `capabilityVersion`),
> roles multiusuario, órdenes de restaurante (meseros/mesas), cocina (comandas/KitchenTicket),
> impresión (PrintJob/reimpresión), tiempo real (SignalR) y la regla `FEATURE_DISABLED`.
> El contrato queda listo para F3. El detalle de la integración se consolida en PARTES 40–48.
>
> **F2.2-B (cierre de observaciones de `docs/CONTRACT-AUDIT.md`):** se resuelven H1, M1–M5 y los LOW
> relevantes antes de implementar F3: `POST /auth/register` completo (PARTE 32.7 / 6.1), semántica
> única de bootstrap (`/sync/push` con `opType='initial'`, eliminado `/sync/initial`), estructura de
> `business` en pull unificada, decisión 17 al día, rol efectivo definido (PARTE 41.5), y bodies de
> `POST /businesses` y `PATCH .../capabilities` (PARTE 6.1–6.2). Registro completo en PARTE 49.

---

## PARTE 1 — Principios generales

1. **Offline-first.** La app funciona 100 % sin red. La API es un servicio de **conciliación**,
   no de operación en vivo. Ninguna venta, apertura o cierre de caja queda bloqueada por red.
2. **El dispositivo local manda mientras esté offline; el servidor es el árbitro débil** para
   catálogos y el **árbitro fuerte** para documentos financieros (órdenes, cierres, movimientos).
3. **Un solo idioma, sin ambigüedad.** Todo el intercambio es JSON (UTF-8) salvo el binario
   indicado de backups. El dinero es **siempre entero en centavos** (jamás flotante).
4. **Identidades por id natural (UUID del cliente).** El servidor **acepta el id que genera el
   cliente** para productos, clientes, proveedores, órdenes, movimientos, cierres y negocios.
   El servidor solo genera ids para lo que es suyo: usuarios, sesiones, backups, códigos de
   recuperación y el **número de factura global**.
5. **Base path:** `https://api.vendelo.app/api/v1` (dominio provisional). Todos los endpoints
   cuelgan de este prefijo. *Se añade `/v1` al diseño previo de `BACKEND-AUDIT.md §20` (que usaba
   `/api/...` sin versión) para permitir evolución sin romper la app.*
6. **Solo JSON en requests/responses.** No XML, no GraphQL, no WebSockets.
7. **Lote bounded.** Sync y backups tienen límites de tamaño para proteger ambos lados (ver PARTE 31).
8. **Monitorización por negocio y por dispositivo** desde el inicio, usando cabeceras comunes
   (ver PARTE 3).
9. **Sin estado compartido en memoria.** El servidor debe poder escalar horizontalmente: toda
   idempotencia se resuelve en la base de datos, no en procesos.
10. **Capacidades por negocio.** Vendelo es un POS multipropósito: el núcleo (POS, productos,
    clientes, inventario, caja, órdenes) es universal y las funciones de restaurante
    (meseros, mesas, cocina, impresión) son **capacidades opcionales** por negocio (PARTE 40).
    OFF = oculto en UI **y** rechazado en servidor (`403 FEATURE_DISABLED`). Desactivar
    **nunca borra datos**. `businessType` es informativo, no controla permisos.
11. **Tiempo real ≠ sincronización.** SignalR (PARTE 46) sólo acelera notificaciones; el sync
    persistente (`/sync/push|pull`) sigue siendo la fuente final y el mecanismo de recuperación.

---

## PARTE 2 — Identificadores

| Identificador | Generado por | Formato | Persistencia local | Notas |
|---|---|---|---|---|
| `userId` | servidor | UUID v4 (opaco) | — | identidad de cuenta |
| `businessId` | cliente (app) o servidor al crear | id opaco ≤ 64 `[A-Za-z0-9_-]` | `@vendelo/business.id` | 1 usuario → 1..n negocios |
| `deviceId` | cliente (app) | id opaco, estable por instalación | `@vendelo/deviceId` | **se regenera al reinstalar**; NO viaja en backups |
| `productId`, `customerId`, `providerId`, `orderId` | cliente (app) | id opaco (hoy UUID v4 con fallback) | SQLite | PK por negocio |
| `movementId` | cliente (app) | id opaco (UUID) | SQLite `stock_movements.id` | PK global (idempotencia) |
| `closureId` | cliente (app) | id opaco (UUID) | hoy AsyncStorage; GAP → SQLite en F3/F4 | idempotencia por id |
| `sessionId` | servidor | UUID v4 | — | sesión de refresh por dispositivo |
| `backupId` | servidor | UUID v4 | — | metadata de backup |
| `recoveryCode` / `recoveryTicket` | servidor | 6 dígitos / UUID v4 | — | 1 uso, expiración |
| `invoiceNumber` | **servidor (único)** | entero (BIGINT) por negocio | guardado en `orders.invoiceNumber` local | resuelve colisión FAC-NNNN |
| `requestId` | cliente (app) | UUID v4 | outbox de batch | dedupe de transporte |
| `operationId` | cliente (app) | id natural o `del:<entityType>:<entityId>` | outbox de op | dedupe de datos |
| `waiterId` | **= `userId`** (relación User→Waiter) | UUID v4 (opaco) | en `orders.waiterId` | mesero = usuario autenticado, no texto libre |
| `tableId` | cliente (app) | id opaco | en `orders.tableId` | solo con capacidad `tables` ON |
| `kitchenTicketId` | cliente (app) | id opaco (UUID) | en `orders`/`kitchen_tickets` | comanda; la Order es la fuente de verdad |
| `printJobId` | cliente (app) | id opaco (UUID) | cola `print_jobs` | idempotencia de impresión; retry NO reimprime |
| `membershipId` | servidor | UUID v4 | — | User↔Business (rol) |

**Regla de PK para el servidor:** `products`, `customers`, `providers`, `orders` se identifican por
**`(business_id, id)`**, no por `id` global. Esto elimina el riesgo anotado en `BACKEND-AUDIT.md §23-10`
de "productos semilla con ids fijos" (`hamburguesa`, etc.): dos negocios pueden tener `id=hamburguesa`
sin colisionar.

**Regla de unicidad global:** solo los ids de servidor (`userId`, `sessionId`, `backupId`,
`recoveryTicket`, `requestId`) y los `movementId`/`closureId` (append-only audit) son únicos globales.

---

## PARTE 3 — Cabeceras e intercambio

**Cabeceras propias (CommonHeaders):**

| Cabecera | Obligatoria | Contenido |
|---|---|---|
| `Authorization: Bearer <accessToken>` | sí (excepto auth pública y pull snapshot anónimo prohibido — ver PARTE 5) | access token |
| `X-Device-Id` | sí | `deviceId` que origina la petición |
| `X-Request-Id` | sí (idempotencia) | UUID v4 de la petición |
| `Content-Type: application/json` | sí si hay body | JSON UTF-8 |
| `X-API-Version` | opcional | versión semántica de la app (p.ej. `1.0.0`) |
| `Accept-Language` | opcional | mensajes localizados (`es-DO` por defecto) |

**Envoltorio de error (regla única):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descripción legible para el usuario",
    "requestId": "3f8b…",
    "details": { "campo": "motivo" }
  }
}
```

Códigos de error completo en PARTE 23. Status HTTP en PARTE 34.

**Siempre se responden `requestId` y `serverTime` (ISO 8601 UTC)**, para correlación entre app y
servidor (diagnóstico de reloj en LWW, ver PARTE 16).

---

## PARTE 4 — Fechas y reloj

1. Todo timestamp se envía **ISO 8601 UTC con `Z`** y milisegundos: `2026-09-21T14:03:05.123Z`.
2. La app ya escribe `new Date().toISOString()` en `createdAt`/`updatedAt`/`paidAt`/`closedAt`:
   compatible sin cambios.
3. **Autoridad del reloj:**
   - **Catálogos (Tier 1):** `updatedAt` del cliente es la clave LWW. Riesgo conocido: un dispositivo
     con reloj adelantado puede ganar por error. Mitigación **documentada** (no implementada en F2):
     el servidor guarda también `received_at` (servidor) y audita discrepancias. En F3 se puede añadir
     una normalización opcional, pero el **contrato** no la exige (evitar sobre-ingeniería).
   - **Financieros (Tier 2):** NUNCA la pared del cliente es autoridad de orden. Las transiciones de
     orden y la asignación de `invoiceNumber` se sellan con el reloj del **servidor**. `createdAt` del
     cliente se conserva como dato (para tickets), no como orden.
4. `lastSyncAt` (local) y `lastServerCursor` (local) son informativos/posicionales; el **cursor** es la
   posición real (PARTE 21).
5. Paginación cursor-based: sin `updatedAt` como offset (evita saltos/solapamientos).

---

## PARTE 5 — Autenticación

Diseño **server-side**. En la app la autenticación local (PBKDF2-HMAC-SHA256, 100 000 iteraciones,
SecureStore) **permanece intacta**; esta API añade la capa de cuenta remota encima. El backend jamás
recibe `passwordHash`/`passwordSalt` locales (reforzar con test en el backend, ver `BACKEND-AUDIT.md §22-4`).

### 5.1 Token session (modelo)

| Elemento | Regla |
|---|---|
| `accessToken` | JWT de corta vida (**15 min**), claims: `sub` (userId), `businessId` (activo), `deviceId`, `role`, `exp`, `jti` |
| `refreshToken` | opaco, rotativo; **acceso JWT 15 min** — refresh activo **48 h**, cadena de uso **30 días sin uso**; sin uso en 30 días se revoca; guardado **hash** en `sessions.refresh_token_hash` |
| `sessions` | 1 sesión por dispositivo; `refresh_token_hash`, `expires_at`, `revoked_at`, `created_at`, `last_used_at` |
| `changeEpoch` | entero en `users`; se incrementa al resetear contraseña → **invalida todas las sesiones/dispositivos** |

### 5.2 Endpoints

| Método/Path | Body | Requisitos | Respuestas |
|---|---|---|---|
| `POST /auth/register` | esquema en PARTE 32.7; transacción completa definida en PARTE 6.1 | público; rate-limit | `201` con tokens + user + businesses[] |
| `POST /auth/login` | `{ identifier, password, deviceId, deviceName, deviceRole? }` (`deviceRole` opcional ∈ Roles.All, se aplica al device) | público; rate-limit | `200` tokens + `businesses[]` |
| `POST /auth/refresh` | `{ refreshToken, businessId? }` (`businessId` opcional conserva el negocio activo) | sesión activa | `200` tokens rotados (es `409` si fue ya rotado y reusado: señal de robo) |
| `POST /auth/switch-business` | `{ businessId, deviceName? }` | autenticado; membresía activa en el negocio destino | `200` tokens + `businesses[]` (crea/asegura el device en el negocio destino; PK de Devices compuesta `(BusinessId, Id)`) |
| `POST /auth/logout` | `{ refreshToken }` | sesión activa | `204`; revoca sesión y refresh en servidor/cliente |
| `POST /auth/change-password` | `{ currentPassword, newPassword }` | autenticado | `204`; invalida otras sesiones |
| `GET /auth/me` | — | autenticado | `200` perfil + membresías |
| (Recuperación) | | Ver PARTE 20 | |

**Reglas de seguridad (mínimas):**
- contraseñas del servidor: **Argon2** (o bcrypt), sal propia; no reutiliza el KDF del dispositivo.
- access token JWT firmado, sin secretos del cliente.
- `identifier` puede ser `email` o `phone` (el registro requiere al menos uno — **GAP**: la app hoy no
  pide email/teléfono; se añadirá en la fase de cuenta (ver PARTE 36-G3/G8)).
- rate-limit en login/registro/refresh por IP + cuenta + dispositivo; mensajes **genéricos** (anti-enumeración).

---

## PARTE 6 — Negocios (Business)

La entidad local es `Business` (`@vendelo/business`): `{ id, name, ownerName?, phone?, address?,
logoBase64?, invoiceMessage?, createdAt, updatedAt? }`. El contrato la refleja **y añade** lo mínimo
necesario del multiusuario y de las **capacidades** (PARTE 40).

**Forma del contrato:**

```json
{
  "id": "business-abc…",
  "name": "Mi Negocio",
  "ownerName": "Juan Pérez",
  "businessType": "RESTAURANT",
  "capabilities": {
    "restaurant": true,
    "waiters": true,
    "tables": false,
    "kitchen": true,
    "kitchenPrinting": true
  },
  "settings": {
    "invoice": { "prefix": "FAC" },
    "kitchenPrinters": ["dev-imp-01"]
  },
  "capabilityVersion": 7,
  "phone": "+1809…",
  "address": "Santo Domingo",
  "logoBase64": null,
  "invoiceMessage": "¡Gracias por su compra!",
  "createdAt": "2026-09-21T10:00:00.000Z",
  "updatedAt": "2026-09-21T10:00:00.000Z"
}
```

**Endpoints:**

| Método/Path | Uso |
|---|---|
| `GET /businesses` | lista de negocios del usuario autenticado (membresías) |
| `POST /businesses` | crea negocio (`businessId`, `businessType` y `capabilities` opcionales; si vienen, se respetan) |
| `GET /businesses/{id}` | detalle (solo si es miembro) |
| `PATCH /businesses/{id}` | actualiza `name`, `ownerName`, `phone`, `address`, `invoiceMessage`, `logoBase64` |
| `PATCH /businesses/{id}/capabilities` | **solo `owner`/`admin`**: actualiza `businessType`, `capabilities`, `settings` → sube `capabilityVersion` (aplicación de la regla de visibilidad en todos los dispositivos vía sync) |
| `GET /businesses/{id}/capabilities` | cualquier miembro: `businessType`, `capabilities`, `settings`, `capabilityVersion` actuales |
| `DELETE /businesses/{id}` | marca inactivo (soft); solo si la identidad es dueña |

**Reglas:**
- `id` tiene que matchear `${'business-'}` opcional + id opaco; si el cliente lo omite, el servidor lo genera.
- el **`id` local se conserva** (no se regera nunca): es la clave de unión entre `@vendelo/business` y el servidor.
- `logoBase64` puede ser pesado; se acepta ≤ 1 MB; sincronización de imágenes fuera de scope (ver PARTE 36-G7).
- `updatedAt` se envía siempre (local), usado como LWW de configuración.
- **Tipo ≠ permisos:** `businessType` es informativo (PARTE 40.1). Las capacidades (`capabilities`) son
  las que habilitan funciones; su validación se hace en el servidor (PARTE 22.2).
- **`capabilityVersion`:** entero que sube con cada cambio de `capabilities`/`settings`; viaja en el
  `Business` (Tier 1 LWW) para que los dispositivos refresquen su caché de capacidades offline.
- **No-destrucción:** `PATCH /capabilities` con una capacidad en OFF **no borra** órdenes, comandas,
  mesas, meseros, tickets ni configuraciones (PARTES 40.6 y 42.4).

### 6.1 `POST /api/v1/businesses` (alta de negocio)

**Cuando se usa:** registro inicial (`POST /auth/register`, mismo transacción) o un usuario autenticado
que crea un negocio adicional (con `owner.../admin` de su cuenta).

**Request:**

```json
{
  "businessId": "business-abc…",
  "name": "Mi Negocio",
  "ownerName": "Juan Pérez",
  "businessType": "COMMERCE",
  "capabilities": { "restaurant": false, "waiters": false, "tables": false, "kitchen": false, "kitchenPrinting": false },
  "settings": { "invoice": { "prefix": "FAC" }, "currency": "DOP" }
}
```

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `businessId` | string ≤64 `[A-Za-z0-9_-]`, prefijo opcional `business-` | no | si se omite, el servidor lo genera; **se conserva** el id local de `@vendelo/business` (clave de unión) |
| `name` | string 1..120 | **sí** | |
| `ownerName` | string ≤120 | no | |
| `businessType` | enum P.40.1 | no | default `COMMERCE`; **informativo, nunca autoriza** |
| `capabilities` | objeto P.40.2 | no | default todas OFF; el bootstrap del dueño puede activarlas aquí |
| `settings` | objeto P.40.3 | no | admite `invoice.prefix` y `currency`; `kitchenPrinters` solo si `kitchenPrinting` va ON (si OFF, se ignoran/descartan) |

**Validaciones:** `400 VALIDATION_ERROR` si `name` vacío o >120, `businessId` mal formado, `businessType`
fuera del enum, o `capabilities` con claves desconocidas. Si `businessId` ya existe para la cuenta que
lo crea → `409 CONFLICT` (la idempotencia del `requestId` devuelve el objeto original sin duplicar).

**Response `201`:**

```json
{
  "business": {
    "id": "business-abc…",
    "name": "Mi Negocio",
    "ownerName": "Juan Pérez",
    "businessType": "COMMERCE",
    "capabilities": { "restaurant": false, "waiters": false, "tables": false, "kitchen": false, "kitchenPrinting": false },
    "settings": { "invoice": { "prefix": "FAC" }, "currency": "DOP" },
    "capabilityVersion": 1,
    "createdAt": "2026-09-21T10:00:00.000Z",
    "updatedAt": "2026-09-21T10:00:00.000Z"
  },
  "membership": { "id": "membership-…", "businessId": "business-abc…", "userId": "usr-…", "role": "owner" }
}
```

`capabilityVersion` inicia en `1` (o se conserva el que ya existiera localmente si el `businessId` venía
con datos… el servidor lo normaliza al máximo de servidor/local +1 en la primera subida Modo B, PARTE 25).

### 6.2 `PATCH /api/v1/businesses/{businessId}/capabilities` (cambio de capacidades)

**Request (patch parcial, al menos un campo):**

```json
{
  "expectedCapabilityVersion": 7,
  "businessType": "RESTAURANT",
  "capabilities": { "restaurant": true, "waiters": true, "tables": false, "kitchen": true, "kitchenPrinting": true },
  "settings": { "invoice": { "prefix": "FAC" }, "kitchenPrinters": ["dev-imp-01"], "currency": "DOP" }
}
```

| Campo | Tipo | Regla |
|---|---|---|
| `expectedCapabilityVersion` | int | **precondición optimista (obligatoria).** El servidor compara con la versión vigente: si difiere → `409 VERSION_MISMATCH` con `details.current`; la app re-`GET` y reintenta. Evita sobrescribir el cambio de otro usuario/admin sin leerlo. |
| `businessType` | enum P.40.1 | opcional; informativo, no autoriza |
| `capabilities` | objeto P.40.2 | opcional; **solo claves conocidas**; claves desconocidas → `400` |
| `settings` | objeto P.40.3 | opcional; claves de capacidades OFF se aceptan pero quedan inactivas y se conservan |

Tras aplicar → `capabilityVersion++` y `updatedAt` actualizado.

**Response `200`:** el `business` completo con las capacidades nuevas, `settings` activos,
`capabilityVersion` (nuevo) y timestamps (misma forma que `GET .../capabilities`, PARTE 6).

**Comportamiento OFF (reglas vinculantes):**
1. **UI:** toda funcionalidad de una capacidad OFF se **oculta** en la app (caché de `Business`, P.40.5).
2. **Servidor:** cualquier endpoint/operación de esa capacidad → `403 FEATURE_DISABLED` (P.22.2), incluso
   si la app manipulada lo intenta. Aplica también a operaciones de sincronización de esa capacidad.
3. **No-destrucción:** desactivar NO borra órdenes, comandas, mesas, meseros, tickets, historial ni
   configuraciones (P.40.6).
4. **Drenaje:** las operaciones pendientes de la capacidad **no se pueden crear nuevas**, pero las
   existentes pueden completarse (cerrar/entregar/anular comandas, imprimir pendientes, cobrar).
5. **Reactivar** una capacidad restaura la funcionalidad y el acceso a los datos intactos.

---

## PARTE 7 — Dispositivos (Devices & Sessions)

El `deviceId` local es el `X-Device-Id` de todas las peticiones. El servidor registra cada dispositivo
como **trusted device** del negocio para: revocación, sesiones, y `deviceId` en cada `stock_movement`.

**Endpoints:**

| Método/Path | Uso |
|---|---|
| `POST /devices` | alta/confirmación de dispositivo tras login/registro (body `{ deviceId, name, platform, appVersion, role }`) |
| `GET /devices` | lista dispositivos del negocio |
| `POST /devices/{deviceId}/revoke` | revoca dispositivo (idempotente): invalida sesiones y lo marca `revoked` |
| `DELETE /devices/{deviceId}` | alias no destructivo → `409` si hay datos pendientes; usar revoke |

**Forma `Device`:** `{ id, businessId, name, platform ('ios'|'android'|'web'|'other'),
role ('admin'|'cashier'|'waiter'|'kitchen'|'printer'), appVersion, lastSeenAt, createdAt, revokedAt }`.

**Reglas:**
- `deviceId != userId != businessId` (3 identidades distintas).
- Un dispositivo revocado no puede sync (403); sus movimientos en vuelo se siguen aplicando si llegaron
  antes de la revocación (orden de llegada en la cola, sin rechazo retroactivo de ventas pagadas).
- Reinstalar la app regenera `deviceId` → se registra de nuevo; los datos previos del dispositivo
  permanecen bajo el negocio.
- **Rol por dispositivo (PARTE 41):** determina qué capacidades/endpoints puede usar, además del
  permiso de miembros. Un dispositivo `waiter` NO abre caja; uno `cashier` no gestiona comandas.

---

## PARTE 8 — Productos (catálogo)

La app modela `Product` (SQLite `products`). Forma del contrato (1:1 con la app, con `businessId`):

```json
{
  "id": "hamburguesa",
  "businessId": "business-abc…",
  "name": "Hamburguesa",
  "priceCents": 25000,
  "category": "Comidas",
  "imageType": "emoji",
  "emoji": "🍔",
  "icon": null,
  "imageUri": null,
  "stockQuantity": 42,
  "active": true,
  "provider": "Carnicería Central",
  "providerPhone": "809-…",
  "createdAt": "2026-01-01T12:00:00.000Z",
  "updatedAt": "2026-09-20T18:00:00.000Z",
  "deletedAt": null
}
```

**Reglas de negocio para el contrato:**

| Regla | Detalle |
|---|---|
| CRUD | `create` (201), `update` (200, PATCH de campos editables: todo excepto `stockQuantity` manualmente), `soft-delete` (tombstone `deletedAt`) |
| Listado | cursor + filtros `active`, `category`, `q` (búsqueda name) |
| `stockQuantity` | **NO es de autoridad LWW** (ver PARTE 15). Se envía como proyección, pero la verdad la dan los `stock_movements`. En sync, la app debe **recalcular** el stock local al recibir movimientos/snapshot. |
| LWW | `updatedAt` del last-editor; tie-break ver PARTE 16. |
| Tombstone | `deletedAt` gana para siempre; re-crear = nuevo `id` |
| Images | `imageUri` / `emoji` / `icon` son metadatos; las fotos **no** se sincronizan (GAP→G7) |

---

## PARTE 9 — Clientes y Proveedores

App: `Customer` y `Provider` casi idénticos: `{ id, name, phone?, address?, note?, createdAt,
updatedAt?, deletedAt? }`.

**Forma del contrato (ambas entidades):**

```json
{
  "id": "cus-…",
  "businessId": "business-abc…",
  "name": "María Gómez",
  "phone": "829-…",
  "address": "",
  "note": "",
  "createdAt": "…",
  "updatedAt": "…",
  "deletedAt": null
}
```

**Endpoints:** `GET /customers`, `POST /customers`, `GET /customers/{id}`, `PATCH /customers/{id}`,
`DELETE /customers/{id}` (soft). Igual para `/providers`. Mismas reglas LWW/tombstone que productos.

---

## PARTE 10 — Órdenes (Finanzas Tier 2)

La app tiene `Order` con estados `pending → paid → voided`, precios **congelados** en items snapshot,
cliente copiado, y tombstones para **pendientes canceladas** (`orders.deletedAt` en SQLite).

**Forma del contrato (fundida con los campos locales):**

```json
{
  "id": "ord-…",
  "businessId": "business-abc…",
  "number": 7,
  "invoiceNumber": 1042,
  "status": "paid",
  "paymentMethod": "cash",
  "receivedCents": 100000,
  "changeCents": 500,
  "subtotalCents": 99500,
  "tipCents": 0,
  "items": [
    {
      "productId": "hamburguesa",
      "name": "Hamburguesa",
      "quantity": 2,
      "unitPriceCents": 25000,
      "lineTotalCents": 50000
    }
  ],
  "customer": { "name": "María", "phone": "", "address": "", "description": "" },
  "customerName": "María",
  "customerPhone": "",
  "customerAddress": "",
  "customerDescription": "",
  "orderType": "waiter",
  "waiterId": "usr-carlos…",
  "waiterName": "Carlos",
  "tableId": "tbl-12",
  "tableName": "Mesa 12",
  "customerId": "cus-123",
  "kitchenTicketId": "kt-…",
  "prepStatus": "preparing",
  "events": [
    { "id": "evt-1", "type": "created", "actorId": "usr-carlos…", "at": "2026-09-21T10:00:00.000Z" },
    { "id": "evt-2", "type": "kitchenSent", "actorId": "usr-carlos…", "at": "2026-09-21T10:00:03.000Z" },
    { "id": "evt-3", "type": "paid", "actorId": "usr-caja…", "at": "2026-09-21T10:00:01.000Z" }
  ],
  "createdAt": "2026-09-21T10:00:00.000Z",
  "updatedAt": "2026-09-21T10:00:00.000Z",
  "paidAt": "2026-09-21T10:00:01.000Z",
  "voidedAt": null,
  "voidReason": null,
  "deviceId": "dev-…",
  "deletedAt": null,
  "version": 2
}
```

> **Campo nuevo requerido:** `items[].productId` — la app hoy guarda el snapshot `CartItem` dentro del
> objeto `product`, que **no** es el id. El contrato requiere una referencia estable al producto
> (para auditoría de stock/devolución). **GAP → F4 cambio mínimo en la app** (`toSyncOrder()`: derivar
> `productId` del snapshot). No requiere migración de datos existentes (se deriva del snapshot).

**Reglas de negocio (inmutabilidad):**

| Regla | Detalle |
|---|---|
| `pending` | editable: solo items + customer; sin `paidAt`/`voidedAt`; se cancela con `deletedAt` (tombstone) |
| `pending → paid` | admite `paymentMethod`, `receivedCents`, `changeCents`; sellos por el **servidor** |
| `paid → voided` | requiere `voidReason`; `subtotalCents` **no cambia** (se compensa con movimientos) |
| `paid`/`voided` | **inmutables**; cualquier update que no sea `paid→voided` → `409` |
| reenvío de venta igual | idempotente por `id` de orden; **nunca se duplica** |
| `number` local | correlativo local por dispositivo; **No es único global** |
| `invoiceNumber` | lo asigna el **servidor** una sola vez (Parte 11) |

**Endpoints directos** (se usan cuando hay red para venta en línea; la misma semántica se usa en sync):

| Método/Path | Uso |
|---|---|
| `POST /orders` | crea orden (`pending` o `paid` si `invoiceNumber` asignado; ver G3) |
| `GET /orders` | listado cursor + filtros (`status`, `dateFrom`, `dateTo`, `q`) |
| `GET /orders/{id}` | detalle |
| `PATCH /orders/{id}` | solo `pending` (items/customer) |
| `POST /orders/{id}/pay` | `pending → paid` (asigna `invoiceNumber`) |
| `POST /orders/{id}/void` | `paid → voided` (idempotente) |
| `POST /orders/{id}/cancel` | `pending → cancelado` (tombstone) |

### 10.1 Órdenes de restaurante (capacidades — ver PARTES 42–44)

Los campos anteriores (`orderType`, `waiterId`, `waiterName`, `tableId`, `tableName`, `prepStatus`,
`events[]`) son **opcionales y dependen de las capacidades del negocio**:

| Campo | Capacidad requerida | Regla |
|---|---|---|
| `orderType: 'waiter'` | `waiters` | `waiters` OFF con `orderType='waiter'` → `400 VALIDATION_ERROR` |
| `waiterId` / `waiterName` | `waiters` | `waiterId` **OBLIGATORIO** si `waiters` ON; debe existir y ser un usuario con rol `waiter` en el negocio |
| `tableId` / `tableName` | `tables` | opcional; si va, debe pertenecer al negocio |
| `customerId` | — | opcional; si va, debe referenciar un `Customer` del negocio (el snapshot `customerName` sigue siendo el que imprime el ticket) |
| `kitchenTicketId` | `kitchen` | opcional; lo asigna quien envía a cocina (PARTE 43); la Order sigue siendo la fuente de verdad |
| `prepStatus` | `kitchen` | track de preparación, ortogonal al pago (PARTE 44) |
| `events[]` | — (auditoría) | historial append-only; **escriben**: el cliente crea opcionalmente `created`; el **servidor añade** `paid`/`voided`/`kitchenSent`/`prepStatusChanged`/`cancelled` en cada transición (nunca en el payload de la app, solo lectura en la app) |

**Regla anti-orden-pendiente-anónima (con `waiters` ON):** se requiere
`waiterId` **y** al menos uno de (`tableId`/`tableName`, `customerId`, o `customer.customerName` no vacío);
si no → `400 VALIDATION_ERROR` con `details.rule: 'anonymous_order'`.

```
waiters ON:  Carlos + Mesa 12                     ✓
             Carlos + Cliente Pedro (customerId)  ✓
             Carlos + Mesa 12 + Pedro             ✓
             Carlos (sin mesa ni cliente)         ✗ (400 anonymous_order)
```

**Edición tras envío a cocina:** `PATCH /orders/{id}` (items/customer) sólo está permitido si
`status=pending` **y** `prepStatus ∈ {new, undefined}` (aún no enviada). Una vez `sent+`, editar la
comanda → `409 INVALID_STATE`; la vía correcta es cancelar la comanda y recrear (PARTE 43.4).

**Comanda vs factura:** el `pending` de un mesero es una **comanda** (puede ir a cocina antes de
pagar); `paid` es la **venta/factura**. El dinero, `invoiceNumber`, movimientos de stock y cierre de
caja son **independientes** de la preparación (PARTE 44).

---

## PARTE 11 — Número de factura global (resuelve FAC-NNNN)

**Problema actual (confirmado en código):** `orders.number` es un entero correlativo **por dispositivo**
(in-memory `nextNumber`; `setNextOrderNumber` en `database.native.ts`). Dos dispositivos pueden
facturar `FAC-0001` simultáneamente; el ticket local (`invoiceCodeFor(number)` en `utils/invoice.ts`)
no es globalmente único.

**Decisión del contrato:**

1. **El servidor asigna `invoiceNumber`** (BIGINT, secuencia PostgreSQL) **por negocio**, de forma
   atómica (en la misma transacción que confirma la orden: `pending→paid`, o en el import del snapshot
   inicial para órdenes ya pagadas sin número).
2. `UNIQUE (business_id, invoice_number)` garantiza no duplicados, incluso con sync concurrente.
3. **Flujo offline:** una venta offline se crea con `number` local y `invoiceNumber = null`. Al confirmar
   el sync, el servidor asigna `invoiceNumber` y devuelve el mapping → la app lo guarda en `orders`.
4. **Display:** mientras `invoiceNumber == null`, el ticket muestra el FAC-NNNN local (comportamiento
   actual intacto). Una vez asignado, muestra `FAC-<invoiceNumber>`.
5. **Importación histórica (primer sync — Modo B, PARTE 25):** las órdenes ya pagadas sin número reciben
   `invoiceNumber` en el snapshot inicial con la **secuencia consecutiva** desde la base; el FAC local
   antiguo se conserva como historial (campo opcional `legacyNumber`), documentando que el historial
   pre-migración mantiene su numeración local para no inventar tickets.

**Consecuencia de diseño:** se elimina la colisión FAC-NNNN del riesgo #1 de `BACKEND-AUDIT.md §23`.

---

## PARTE 12 — Inventario (movimientos de stock)

La app ya tiene la entidad perfecta para la outbox Tier-3: `StockMovement`
(`stock_movements.id`, `product_id`, `quantity` **con signo**, `movement_type`, `reference_id`,
`device_id`, `synced`, `created_at`; LT `movementType: 'SALE'|'RETURN'|'ADJUSTMENT'|'INITIAL_STOCK'`).

**Forma del contrato:**

```json
{
  "id": "mov-…",
  "businessId": "business-abc…",
  "productId": "hamburguesa",
  "quantity": -2,
  "movementType": "SALE",
  "referenceId": "ord-…",
  "deviceId": "dev-…",
  "createdAt": "2026-09-21T10:00:01.000Z"
}
```

**Reglas:**

| Regla | Detalle |
|---|---|
| Signo | `SALE: −abs`, `RETURN: +abs`, `ADJUSTMENT: +/− delta`, `INITIAL_STOCK: +apertura` |
| `referenceId` | `orderId` para SALE/RETURN; `productId` (ajuste) o `null`; el servidor lo valida apuntando a entidad existente **o queda `null`** si el ajuste no referencia orden |
| Append-only | **nunca se actualiza ni borra** un movimiento confirmado |
| Idempotencia | por `id` (natural del movimiento) |
| Cálculo de stock | `stock = apertura(snapshot/INITIAL_STOCK) + Σ movimientos`. El servidor **computa**, no confía en `products.stockQuantity` |
| Sobreventa | si el cálculo del stock del producto resulta negativo se registra el flag `stock_reconciliation` y **no** se rechazan ventas pagadas (regla `SYNC-STRATEGY §15`) |
| `deviceId` | obligatorio (de la petición o del movimiento); para auditoría multidispositivo |

**GAP actual confirmado:** la app hoy graba movimientos del producto local con `synced=false` pero
**sin `businessId`** (no hay columna). No requiere cambio para el contrato (el `businessId` va en el
envelope de sync), pero **F4 debe fijar `deviceId` en `recordMovement`** y considerar añadir columna
`business_id` para identidad local. Documentado; no implementado.

---

## PARTE 13 — Caja y cierres (Cash registers & closures)

**Apertura (register):** hoy es **local por dispositivo** (`@vendelo/cashRegister`): `{ id,
openingAmountCents, openedAt }`. Decisión: **la caja abierta NO se sincroniza** (cada banda/caja física
es local). Solo se sincronizan los **cierres** (inmutables).

**Cierre (closure) — forma del contrato:**

```json
{
  "id": "cl-…",
  "businessId": "business-abc…",
  "deviceId": "dev-…",
  "openedAt": "2026-09-20T08:00:00.000Z",
  "closedAt": "2026-09-20T20:00:00.000Z",
  "openingAmountCents": 5000,
  "expectedCashCents": 60500,
  "countedCashCents": 60900,
  "differenceCents": -400,
  "orderCount": 28,
  "salesCents": 55500,
  "cashSalesCents": 55500,
  "transferSalesCents": 0
}
```

**Reglas:**

| Regla | Detalle |
|---|---|
| Inmutabilidad | cierre = **snapshot inmutable**; modificar/borrar → `409` |
| `openedAt` | nuevo campo opcional (la app de hoy no lo guarda en el closure; se puede derivar o añadir en F4) |
| `expectedCashCents` | `openingAmountCents + cashSalesCents` (regla existente en `utils/cashClosure.ts`) |
| `differenceCents` | `expected − counted` (negativo = falta, positivo = sobra; ticket actual lo invierte de display, no de dato) |
| Pagado o transferencia | `transferSalesCents` separa pagos no-efectivo |
| Idempotencia | por `id` del cierre |

**GAP estructural confirmado:** hoy los cierres viven en **AsyncStorage** (`@vendelo/cashClosures`), no en
SQLite, por lo que no están en el outbox. **F3/F4** deben migrarlos a SQLite (mismo esquema, sin cambios
de semántica) para poder sincronizarlos. Mientras tanto el contrato queda definido y estable.

---

## PARTE 14 — Sincronización (flujo push/pull)

### 14.1 Concepto

- **Los** dispositivos **no llaman endpoints de "venta en vivo"**: la app crea local y **empuja lotes**.
  Los endpoints directos de la Parte 10 existen para el caso en línea favorable, pero el **contrato
  principal** es el lote de sync.
- Todo viaja con un `deviceId`, `businessId` y `requestId`.

### 14.2 Push

```
POST /sync/push
{
  "requestId": "req-…",
  "deviceId": "dev-…",
  "businessId": "business-abc…",
  "ops": [
    { "operationId": "ord-…", "entityType": "order", "entityId": "ord-…", "opType": "upsert", "payload": {…}, "createdAt": "…" },
    { "operationId": "mov-…", "entityType": "movement", "entityId": "mov-…", "opType": "upsert", "payload": {…}, "createdAt": "…" },
    { "operationId": "del:product:hamburguesa", "entityType": "product", "entityId": "hamburguesa", "opType": "delete", "payload": {"deletedAt": "…"}, "createdAt": "…" },
    { "operationId": "cl-…", "entityType": "closure", "entityId": "cl-…", "opType": "upsert", "payload": {…}, "createdAt": "…" }
  ]
}
```

**Respuesta:**

```json
{
  "requestId": "req-…",
  "serverTime": "2026-09-21T10:05:00.000Z",
  "processed": true,
  "results": [
    { "operationId": "ord-…", "status": "applied", "invoiceNumber": 1042 },
    { "operationId": "mov-…", "status": "applied" },
    { "operationId": "del:product:hamburguesa", "status": "applied" },
    { "operationId": "cl-…", "status": "applied" }
  ],
  "cursor": "v1:eyJzZXEiOjg0fQ=="
}
```

**Reglas del push:**
- lote único: ≤ **500 ops** o ≤ **4 MB** (lo que ocurra antes); límite en la misma transacción.
- procesar **en una transacción**; ops individuales se validan; una op inválida → `rejected` en
  `results` (con `code`) pero **no aborta el resto**.
- `applied` → servidor persistió; `skipped_duplicate` → ya existía (idempotencia); `rejected` → con
  error, para que la app lo gestione (p.ej. 409 de orden).
- una orden deduplicada devuelve su `invoiceNumber` ya asignado.
- cualquier operación rechazada mantiene `synced=false` local → reintento dirigido.

**Semántica única del bootstrap (cierra M1):** **no existe el endpoint `POST /sync/initial`.** El primer
envío de datos locales preexistentes (Modo B, PARTE 25) se hace **siempre** vía `POST /sync/push` con
`opType='initial'` (batch completo, una sola transacción). Fuera del bootstrap inicial, `opType` vale
`upsert` | `delete`; `initial` **no puede aparecer** en un batch incremental normal (si aparece →
`400 VALIDATION_ERROR`). La no-repetición y el cursor posterior se describen en PARTE 25.

### 14.3 Pull

```
GET /sync/pull?since=<cursor>&limit=200&deviceId=dev-…
```

```json
{
  "cursor": "v1:eyJzZXEiOjg0fQ==",
  "nextCursor": "v1:eyJzZXEiOjEwMH0=",
  "hasMore": true,
  "serverTime": "2026-09-21T10:05:00.000Z",
  "changes": {
    "business": [ {…} ],
    "products":    [ {…} ],
    "customers":   [ {…} ],
    "providers":   [ {…} ],
    "orders":      [ {…} ],
    "stockMovements": [ {…} ],
    "cashClosures":   [ {…} ]
  }
}
```

**Reglas del pull:**
- `since` vacío/`null` → **snapshot inicial** completo (Modo A, PARTE 25).
- `cursor` inválido/vencido → `400 INVALID_CURSOR`; la app **resetea** a `since=null` y re-snapshot.
- `limit` default 50, max 200; `nextCursor` null = fin.
- cada dispositivo guarda su propio cursor en `sync_state.lastServerCursor`.
- **`business`** (Tier 1 LWW) viaja en el pull: cambios de `capabilities`/`settings` se propagan a
  todos los dispositivos vía `capabilityVersion`; la app compara y refresca su caché de capacidades
  (PARTE 40.5).
- Un dispositivo con caché desactualizada puede operar offline; el **servidor** rechaza al sincronizar
  operaciones que requieran una capacidad ya desactivada (`403 FEATURE_DISABLED`, regla de drenaje PARTE 40.6).

---

## PARTE 15 — Idempotencia

Se implementa **a dos niveles**, tal como dicta `SYNC-STRATEGY.md §8`:

**Nivel 1 — Transporte (`requestId`):**
- tabla `sync_batches((business_id, request_id) UNIQUE)` almacena la respuesta del batch; el dedupe es
  **por negocio** (PARTE 22#5 — evita cross-business replay; un UUID repetido entre negocios no compite).
- reenvío del **mismo `requestId`** → devuelve la respuesta original (200) sin reaplicar.

**Nivel 2 — Datos (`operationId`/claves naturales):**
- upserts: `operationId == id natural` de la entidad → `INSERT … ON CONFLICT DO NOTHING` (entity-type
  id + negocio).
- deletes: `operationId = del:<entityType>:<entityId>` → `ON CONFLICT` idempotente sobre
  `deleted_at` ya presente.
- movimientos/cierres: `id` natural → `DO NOTHING` (append-only).
- órdenes: guardas de transición (Parte 10) + dedupe por id → reenvío no duplica nunca.

**Garantías:**
1. Reintento de `POST /sync/push` nunca duplica ventas, movimientos, cierres ni catálogo.
2. Reintento de `POST /orders/{id}/pay` → misma orden pagada, misma `invoiceNumber`.
3. PayPal-style: un `requestId` repetido, respuesta idéntica.
4. La app resetea `synced` solo en `applied` (nunca en `rejected`), y marca `synced=true` al
   confirmar el batch.

---

## PARTE 16 — Conflictos

### 16.1 Clasificación por entidad (regla: **NO se acepta LWW genérico**)

| Entidad | Régimen | Autoridad | Regla |
|---|---|---|---|
| `business` | Tier 1 | LWW por `updatedAt` | tie-break: mayor `updatedAt`; empate ⇒ mayor `id` (lexicográfico) |
| `products` (salvo stock) | Tier 1 | LWW `updatedAt` | ídem; `stockQuantity` **ignorado como conflicto** |
| `customers` / `providers` | Tier 1 | LWW `updatedAt` | ídem |
| `orders` | Tier 2 | guards + `version` | **NUNCA LWW**; estado inmutable; fuera de orden → `409/INVALID_STATE` |
| `cash_closures` | Tier 2 | append-only | insert-if-absent por id |
| `stock_movements` | Tier 3 | apéndice | insert-if-absent por id |
| tombstones de catálogo | — | `deletedAt` | **delete wins para siempre**; re-crear = nuevo id |

### 16.2 Matriz de escenarios (los 12)

| # | Escenario | Resultado |
|---|---|---|
| 1 | Producto editado en A y B offline a la vez | Gana el `updatedAt` más reciente (A/B indistinto) |
| 2 | Venta offline en A; B modifica el producto antes de que sincronice A | La orden conserva su snapshot; el producto vivo recibe el de B (precio nuevo). Regla LWW parte de la venta ya hecha |
| 3 | Intento de modificar una venta ya pagada | `409 CONFLICT/INVALID_STATE`; el servidor NO toca `paid` |
| 4 | Intento de modificar un cierre ya hecho | `409`; cierres inmutables |
| 5 | Se elimina un producto mientras otro dispositivo está offline | Tombstone gana; el B recibe la baja en el pull y la aplica local |
| 6 | La misma orden llega dos veces (timeout + retry) | Dedupe por `id` + `requestId` → una sola fila, mismo `invoiceNumber` |
| 7 | Venta offline pagada que choca con un ADJUSTMENT de otro dispositivo (mismo producto) | Movimientos son aditivos/conmutativos; stock = apertura ± Σ; posible **sobreventa** → flag, no rechazo |
| 8 | Cambio de precio después de venta pagada | Snapshot inalterado (congelado); solo afecta al calculo futuro |
| 9 | Anulación (void) tras reventa offline | `paid→voided` con motivo; los movimientos `RETURN` se añaden; no duplican |
| 10 | Cierre de caja inmutable reenviado | `skipped_duplicate` |
| 11 | Borrado vs edición simultánea (catálogo) | Tombstone (si `deletedAt` existe) gana; B retira local |
| 12 | Reloj adelantado en un dispositivo (LWW catálogo) | Gana el `updatedAt` mayor; el servidor audita `received_at` (registrado, no acción en F2) |

**Respuestas de conflicto** en `results[]` del push o en endpoint directo: `CONFLICT` (409) con
`details.rules` describiendo la regla violada.

---

## PARTE 17 — Ejemplos JSON críticos

(en `doc` se usan para el contrato; ver también PARTE 32 que los consolida)

Ver PARTE 32 — se incorpora allí un set mínimo: `login`, `refresh`, `sync/push`, `sync/pull`,
`backup upload`, `recovery/request`, `order` y `product`.

---

## PARTE 18 — Backups remotos

### 18.1 Modelo

- Los bytes son **opacos para el servidor** (privacy local-first): POST sube el bundle; en el futuro
  (F5) se podrá **cifrar con clave derivada del password** del usuario; el servidor solo valida el
  **envelope** `{ app, version, exportedAt }`, nunca interpreta el contenido.
- Reutiliza el bundle actual `serializeBackup` (v1), validado con `validateBackupData`, y el patrón
  de restore con cuarentena de la app.

### 18.2 Endpoints

| Método/Path | Uso |
|---|---|
| `POST /backups/{businessId}` | sube bundle **multipart**: campo `metadata` (JSON) + campo `file` (binary) |
| `GET /backups/{businessId}` | lista metadata (cursor, sin bytes) |
| `GET /backups/{businessId}/{backupId}` | descarga bytes (`application/octet-stream`) + headers `X-Content-Sha256`, `X-Content-Size`, `X-Backup-Version` |
| `DELETE /backups/{businessId}/{backupId}` | soft-delete metadata (bytes se retienen por retención) |
| `POST /backups/{businessId}/verify` | opcional; revalida checksum almacenado (health) |

### 18.3 Ciclo receive → validate → checksum → store → confirm

1. **Receive:** subir con `Content-Length` ≤ 50 MB y header `X-Content-Sha256` (hex).
2. **Validate:** se verifica el envelope JSON (versión soportada 1..n) y se descarta si no.
3. **Checksum:** el servidor **recomputa** SHA-256 de los bytes recibidos y compara con el header.
   → desajuste = `400 VALIDATION_ERROR` + `code: CHECKSUM_MISMATCH` (no se almacena).
4. **Store:** bytes a object storage; fila `backups` con `sha256`, `size_bytes`, `object_key`,
   `backup_version`, `exported_at`, `status='stored'`.
5. **Confirm:** `201` con `backupId` + `checksum` aceptado.

### 18.4 Restore en teléfono nuevo (flujo)

```
Instalar Vendelo → login/recovery → negocio → GET /backups → elegir → descargar
→ verificar SHA-256 → descifrar (clave derivada del password, F5) → validar (validateBackupData)
→ aplicar (cuarentena → limpiar → importar) → fijar cursor = exportedAt → sync incremental (Parte 26.3)
```

> Regla documentada en `SYNC-STRATEGY §13`: **Restore es el bootstrap; sync es la vida cotidiana.**

---

## PARTE 19 — Checksum y tamaños

| Recurso | Límite |
|---|---|
| Request JSON (normal) | ≤ 1 MB |
| `POST /sync/push` (lote) | ≤ 500 ops o 4 MB |
| `GET /sync/pull` `limit` | 1..200 (default 50) |
| Backup | ≤ 50 MB |
| `logoBase64` | ≤ 1 MB |
| ids | ≤ 64 chars, `[A-Za-z0-9_-]+` (con prefijo opcional `business-`, `ord-`, etc.) |

Checksum siempre SHA-256 hex. Cabeceras: `X-Content-Sha256`, `X-Content-Size`.

---

## PARTE 20 — Recuperación de cuenta (email/SMS)

Flujo completo (diseño por fases; la app **no tiene hoy email/teléfono** — GAP: ver Parte 36-G8):

**Fases del flujo:**

1. `POST /auth/recovery/request` → **SIEMPRE 202 genérico** (anti-enumeración):

   ```json
   { "channel": "email", "address": "user@example.com" }
   ```
   - genera código **6 dígitos**, hash del código, `expires_at` = +10 min, max 5 intentos.
   - rate-limit: 3/h por `address`, plus IP.
2. `POST /auth/recovery/verify`:

   ```json
   { "channel": "email", "address": "user@example.com", "code": "123456" }
   ```
   - valida hash, 1 uso; devuelve `ticket` (UUID, one-time, 10 min TTL) para resetear.
3. `POST /auth/recovery/reset-password`:

   ```json
   { "ticket": "uuid…", "newPassword": "secret" }
   ```
   - cambia contraseña (Argon2), **incrementa `changeEpoch`** → revoca todas las sesiones/dispositivos.
4. El usuario vuelve a login en el dispositivo nuevo.

**Reglas:** códigos hasheados, one-time, expiración, máx. intentos, mensajes genéricos,
anti-enumeración por address e IP, registros de auditoría (sin exponer datos).

**Nota de diseño:** se requiere que la cuenta tenga email O teléfono. Hoy el setup local no pide
ninguno. La fase de "cuenta" (F3 servidor + pequeño cambio de registro local, F4) añadirá el campo
(opcional si ya existe cuenta, obligatorio al crear cuenta remota) **sin afectar operación offline**.

---

## PARTE 21 — Paginación cursor-based

- **Colecciones:** `GET /products`, `/customers`, `/providers`, `/orders`, `/businesses`: `?cursor=…&limit=…`.
- **Sync pull:** el `cursor` es la posición incremental (Parte 14.3).
- El cursor es **opaco**: `v1:<base64url(seq | filtro-hash | checksum)>`. Nunca se interpreta en cliente.
- `INVALID_CURSOR` (400) → cliente resetea a `since=null` y re-snapshot.
- Nunca usar `offset` (ineficiente con datos vivos); opcional `?to=<ISO>` para retorno de rango.
- Orden de página estable (establecido por `(business_id, updated_at, id)` de índices).

---

## PARTE 22 — Autorización y anti-IDOR

**Regla de oro** (heredada de `BACKEND-AUDIT §22-3` y §20):

> Todo endpoint recibe `businessId` y valida que **pertenece al negocio autenticado**.
> El `id` en la URL **jamás** autoriza: la autoridad es el **token**, no la ruta.

Implementación:

1. JWT con claim `businessId` (activo) — todas las queries filtran por él.
2. `GET /businesses/{id}` valida membresía Owner/Admin explícitamente.
3. Movimientos y cierres llevan `deviceId` además del id de negocio.
4. Endpoint de cálculo: si `businessId` del cuerpo != `businessId` del token → `403`.
5. Idempotencia multiusuario: `requestId` dedupe es **por negocio** (evita cross-business replay).
6. **Módulos sensibles con filtro de membresía obligatorio `(business_id, id)`:** `products`,
   `customers`, `providers`, `orders`, inventario (`stock_movements`), caja (`cash_closures`), `sync`,
   `backups`, `devices`, membresías, y (en F8/F9) restaurante e impresión. Un usuario de `Business A` no
   puede materialmente acceder a datos de `Business B` cambiando `businessId` o el id en la URL: la
   autoridad es el token (`businessId` activo), nunca la ruta.

### 22.1 Roles multiusuario

Roles definidos: `owner`, `admin`, `cashier`, `waiter`, `kitchen`, `printer` (PARTE 41). El rol se
asigna por **membresía** (User↔Business) y puede concretarse por **dispositivo** (PARTE 7).

### 22.2 Puerta de capacidades (regla obligatoria)

Todo endpoint de una capacidad debe validar **dos condiciones**:

1. **Capacidad ON** en `business.capabilities` del negocio del token.
2. **Rol con permiso** para esa capacidad (matriz PARTE 41.3).

Si falla alguna → `403 FEATURE_DISABLED`. Esta regla aplica **incluso si la app está manipulada**:
la UI solo filtra por experiencia; el servidor filtra por autoridad.

| Endpoint/op de capacidad | Requiere (capacidad + rol) |
|---|---|
| Crear/editar órdenes `orderType='waiter'` | `waiters` + `waiter`/`cashier`/`owner`/`admin` |
| Usar `tableId` en órdenes | `tables` + cualquier rol autorizado a crear órdenes |
| Actualizar `prepStatus` | `kitchen` + `kitchen`/`owner`/`admin` |
| Enviar/consultar `print_jobs` de comandas | `kitchenPrinting` + `printer`/`kitchen`/`owner`/`admin` |
| Configurar capacidades | `PATCH /businesses/{id}/capabilities` + `owner`/`admin` |

### 22.3 Interpretación de JWT con capacidades

El token NO embebe el mapa de capacidades (cambia con `PATCH /capabilities` y vence su validez de
cache). El servidor consulta `business.capabilities` en cada petición (row por business, cache corta
por `capabilityVersion`). El UI usa la **caché local** del `Business` para mostrar/ocultar.

---

## PARTE 23 — Errores (códigos)

| `code` | HTTP | Uso |
|---|---|---|
| `VALIDATION_ERROR` | 400 | payload inválido (campo), checksum mismatch (ver `details.code`) |
| `CHECKSUM_MISMATCH` (details.code) | 400 | backup con hash incorrecto |
| `INVALID_CURSOR` | 400 | cursor opaco inválido/vencido → resync |
| `UNAUTHORIZED` | 401 | token faltante/expirado/revocado |
| `FORBIDDEN` | 403 | no miembro del negocio / `deviceId` revocado / permisos |
| `FEATURE_DISABLED` | 403 | capacidad del negocio OFF (vale también si la app manipulada intenta usarla); con `details.capability` |
| `NOT_FOUND` | 404 | entidad no existente o fuera de negocio (no revela existencia) |
| `CONFLICT` | 409 | duplicado real (no idempotente), conflicto de estado, método no permitido (ej. modificar cierre) |
| `INVALID_STATE` | 409 | transición ilegal de orden (paid no editable, etc.) |
| `VERSION_MISMATCH` | 409 | `PATCH /businesses/{id}/capabilities` con `expectedCapabilityVersion` distinto al vigente (P.6.2) |
| `RATE_LIMITED` | 429 | throttling (auth/sync/backups) con header `Retry-After` |
| `SEMANTIC_ERROR` reservado | 422 (opcional) | si se decide validación semántica separada (doc) |
| `PAYLOAD_TOO_LARGE` | 413 | excede límites de Parte 19 |
| `SERVER_ERROR` | 500 / 503 | fallo interno / mantenimiento (con `Retry-After` si 503) |

Envelope siempre: `{ error: { code, message, requestId, details? } }` (ver Parte 3).

---

## PARTE 24 — Multi-dispositivo

- **Concurrencia:** cada dispositivo opera su propia copia SQLite y su **propio cursor**.
- **Ventas:** un dispositivo no afecta flujo de venta de otro; la única intersección es el tamaño del
  `stock_movements` y las órdenes (append/movimientos → no hay READ-WRITE race local).
- **Catálogo:** LWW puede sobrescribir; documentado.
- **Stock negativo (sobreventa):** varios dispositivos pueden vender más de lo que hay (Caso 5).
  Regla acordada: **no se rechaza la venta**; se marca sobreventa (`stock_reconciliation`) y se
  reconcilia en el siguiente cierre.
- **Caja:** un dispositivo = una caja abierta local. Los cierres son **por dispositivo** (no se mezclan
  dos cajas en un mismo cierre).

---

## PARTE 25 — Primera sincronización

Caso **usuario con datos locales (500 productos / 1200 clientes / 3000 ventas — nada en servidor)**

**Dos modos de inicio, una sola semántica por modo (cierra M1):**

- **Modo B — "el negocio ya tiene datos y adopta una cuenta"** (recomendado, coherente con
  `SYNC-STRATEGY §12-B`): subida atómica del snapshot local vía **`POST /sync/push` con
  `opType='initial'`** (NO existe `/sync/initial`). Es la única operación que puede llevar `initial`.
- **Modo A — "dispositivo nuevo sin datos se une a un negocio ya en servidor"**: **`GET /sync/pull?since=null`**
  (snapshot de catálogo + órdenes + cierres; sin `stockMovements`, PARTE 25-A infra).

### Modo B (datos locales preexistentes → cuenta)

1. `POST /auth/login` (o `/auth/register` con `businessId` local, PARTE 32.7) → token + `businessId`.
2. `POST /devices` → alta del dispositivo, `deviceId` local.
3. `POST /sync/push` con `opType='initial'`:

   ```json
   {
     "requestId": "req-init-…",
     "deviceId": "dev-…",
     "businessId": "business-abc…",
     "ops": [
       { "operationId": "<op>:<entity>:<id>", "entityType": "business", "entityId": "business-abc…", "opType": "initial", "payload": {…business…}, "createdAt": "…" },
       { "operationId": "hamburguesa", "entityType": "product", "entityId": "hamburguesa", "opType": "initial", "payload": {…}, "createdAt": "…" },
       { "operationId": "ord-001", "entityType": "order", "entityId": "ord-001", "opType": "initial", "payload": {…}, "createdAt": "…" }
     ]
   }
   ```

   - equivale al bundle `serializeBackup` (v1) **validado** (mismos validadores).
   - el servidor procesa **en una transacción**: valida → inserta → fija **stock de apertura** = stock
     del bundle (sin replay de movimientos históricos, PARTE 12) → asigna `invoiceNumber` a órdenes
     pagadas sin él → normaliza `capabilityVersion` (max(local, server)+1 si hubo divergencia) →
     fija cursor base = `exportedAt`.
   - la respuesta es el formato estándar del push + `cursor` inicial.
4. A partir de ahí, **sync incremental clásico** (`push` normal + `pull` con ese cursor).

### Modo A (dispositivo nuevo sin datos)

`GET /sync/pull?since=null` → snapshot resumido (catálogo + órdenes + cierres + `business` con sus
capacidades); **`stockMovements` NO viajan** en snapshot: el stock de apertura = `products.stockQuantity`
del snapshot. La app fija `sync_state.lastServerCursor` = cursor devuelto. `movements` creados DESPUÉS
fluyen normal (incremental).

### Restaurar un dispositivo (backup) — NO es Modo B

Restore (PARTE 18.4) = bootstrap sin op repetida: aplicar bundle local/descargado → **cursor = exportedAt**
→ sync incremental. **No se reenvía `opType='initial'`** sobre datos restaurados.

### Cursor inválido / reset

`INVALID_CURSOR` (400) o política de la app → **reset a `since=null`** y re-snapshot por el **pull
(Modo A)**; el pull **nunca** lleva `opType='initial'` (esa semántica es exclusiva del push Modo B).

**Regla crítica (acordada en SYNC):** el stock del snapshot es la **apertura**. Los movimientos
históricos **no** se replay para no doblar stock. La idempotencia por id protege cualquier reenvío.

---

## PARTE 26 — Nuevo teléfono

Ver **Parte 18.4** (Restore) y la tabla SYNC vs RESTORE de `SYNC-STRATEGY §13`. En resumen:

- **Restore = bootstrap** (descargar → validar → cifra → aplicar → cursor = exportedAt).
- **Sync = cotidiano** (incremental, nunca bootstrap).
- El nuevo dispositivo además se **registra con su propio `deviceId`** y genera su propio SQLite.
- Si no hay backup y el negocio ya está en el servidor → `Modo A` (Parte 25) = "cuadrar solo el estado".

---

## PARTE 27 — Versionado

- **Ruta:** `/api/v1`. Evolución **aditiva**: nuevos endpoints, campos opcionales.
- **Breaking:** requiere `/v2`; la app declara `X-API-Version`; el servidor soporta N-1 genes.
- Contratos: respetar siempre `response_code` + `envelope` (el cliente ignora campos nuevos que no
  conozca); nunca eliminar un campo sin `deprecated-notice`.
- **Compat backwards (app vieja ↔ server nuevo):** server acepta v1 mientras tenga clientes activos;
  aviso de deprecación + ventana de migración.

---

## PARTE 28 — Seguridad

| Tema | Regla |
|---|---|
| Transporte | HTTPS obligatorio (HSTS). Sin HTTP en producción. |
| Tokens | JWT corto (15 min); refresh **hash** en DB; rotación; revocación por dispositivo y por `changeEpoch`. |
| Aislamiento | Filtro de negocio en TODA query (anti-IDOR Parte 22). |
| Entrada | Validadores de contrato (mismos que `validateBackupData` en puerta de sync); límites Parte 19. |
| Credenciales | **Nunca** `passwordHash`/`passwordSalt` en ningún payload; PBKDF2 local ≠ KDF servidor; tests en backend. |
| TTY | mensajes genéricos en auth/recovery, rate-limit por IP/cuenta/dispositivo. |
| Secretos | JS no expone secretos; secrets solo en configuración de servidor (env/secret manager). |
| Logs | jamás contraseñas, tokens, `salt`, hashes; PII mínima; retención definida. |
| Backups | checksum SHA-256; en F5 cifrado con clave derivada del password (nunca clave en claro). |
| Privacidad | servidor guarda metadatos, no interpreta bundle (privacy ≥ local-first). |
| Idempotencia | evita doble cobro/servicio (Parte 15). |
| Auditoría | `conflict_log` (futuro, F7): eventos de conflicto con requestId para soporte. |

---

## PARTE 29 — Compatibilidad con el modelo actual (GAPs)

| # | GAP | Denunciado en | Resolución (fase, SIN implementar) |
|---|---|---|---|
| G1 | `orders.deletedAt` | ✔ corregido en FASE 1.1 (SQLite ya lo tiene) | — |
| G2 | `orders.items` no lleva `productId` estable (snapshot incluye el producto completo) | este contrato | F4: `toSyncOrder()` deriva `productId`; sin migración |
| G3 | `cashClosures` en AsyncStorage (fuera de SQLite/outbox) | BACKEND-AUDIT §3.2, SYNC §6 | F3/F4: migrar a SQLite, mismo esquema |
| G4 | `business` en AsyncStorage (no SQLite) | BACKEND-AUDIT §3.2 | F4: considerar tabla `business` para unicidad + cursor; **no bloquea** (id ya persistido) |
| G5 | `user` en SecureStore, sin email/teléfono | (F0) + Parte 5 | F3/F4: id. cuenta; réplica local opcional |
| G6 | `stock_movements` sin `businessId` local | este contrato | F4: añadir columna (o usar envelope) |
| G7 | imágenes/fotos locales NO viajan | SYNC §14 | F8 (o nunca): asset remoto |
| G8 | `deviceId` no se fija en `recordMovement` hoy | este contrato | F4: fijar `deviceId` al grabar |
| G9 | `invoiceNumber` de órdenes históricas no existe | PARTE 11 | F4: asignación en snapshot inicial |
| G10 | fichas: las semillas de productos (ids fijos) | BACKEND-AUDIT §5 | resuelto por PK `(business_id, id)` |
| G11 | `sync_state.lastServerCursor`/`lastSyncAt` existen pero no se usan | — | F4: motor de sync los consume |
| G12 | reloj de dispositivo como autoridad LWW | BACKEND-AUDIT §6 | F3 podría normalizar (opcional, sin sobre-ingeniería) |
| G13 | la app de hoy no pide `email`/`teléfono` ni ofrece alta de personal; `POST /auth/register` (P.32.7) los exige para la cuenta remota | este contrato (F2.2-B) | F4: añadir el paso de identidad en el registro local (opcional para app existente, obligatorio al crear la cuenta remota) SIN romper operación offline; reforzado por G5/G8 |

**Ninguno de estos GAPs requiere cambio de entidad ni de regla de negocio hoy.** Se agrupan en la fase
de motor de sync (F4) y cuenta (F3).

---

## PARTE 30 — Tabla maestra de endpoints (v1)

> Ruta base `/api/v1`; **Auth**: token; **Idemp.**: `requestId` protegido.

| Método | Path | Auth | Idemp. | Módulo | Descripción |
|---|---|---|---|---|---|
| POST | `/auth/register` | — | ✔ (email/phone) | Auth | crear cuenta + altusuario + negocio + device |
| POST | `/auth/login` | — | ✔ | Auth | tokens + membresías |
| POST | `/auth/refresh` | refresh | ✔ | Auth | rotar refresh |
| POST | `/auth/logout` | refresh | ✔ | Auth | revocar sesión |
| POST | `/auth/change-password` | access | ✔ | Auth | nueva contraseña + invalidar sesiones |
| GET | `/auth/me` | access | — | Auth | perfil + memb. |
| POST | `/auth/recovery/request` | — | ✔ | Auth | enviar código (202 genérico) |
| POST | `/auth/recovery/verify` | — | ✔ | Auth | validar código → ticket |
| POST | `/auth/recovery/reset-password` | ticket | ✔ | Auth | nueva contraseña + revocar todo |
| GET | `/businesses` | access | — | Business | lista membresías |
| POST | `/businesses` | access | ✔ | Business | crear negocio |
| GET | `/businesses/{id}` | access | — | Business | detalle (membresía) |
| PATCH | `/businesses/{id}` | access | ✔ | Business | editar |
| PATCH | `/businesses/{id}/capabilities` | owner/admin | ✔ | Business | actualizar `businessType`/`capabilities`/`settings` (+ `capabilityVersion`) |
| GET | `/businesses/{id}/capabilities` | access | — | Business | leer configuración de capacidades actual |
| DELETE | `/businesses/{id}` | access (owner) | ✔ | Business | soft-deactivate (solo si la identidad es dueña) |
| GET | `/devices` | access | — | Device | lista dispositivos |
| POST | `/devices` | access | ✔ | Device | registrar/confirmar |
| POST | `/devices/{deviceId}/revoke` | access (owner) | ✔ | Device | revocar |
| POST | `/businesses/{id}/members` | owner/admin | ✔ | Tenancy | crear/alta usuario con rol (alta de meseros) |
| GET | `/businesses/{id}/members` | access | — | Tenancy | lista miembros y roles del negocio |
| PATCH | `/businesses/{id}/members/{userId}` | owner/admin | ✔ | Tenancy | cambiar rol / reset credenciales / desactivar miembro (NO borra historial) |
| GET | `/products` | access | — | Catálogo | listado cursor/scope |
| POST | `/products` | access | ✔ | Catálogo | crear |
| GET | `/products/{id}` | access | — | Catálogo | detalle |
| PATCH | `/products/{id}` | access | ✔ | Catálogo | editar (LWW) |
| DELETE | `/products/{id}` | access | ✔ | Catálogo | soft-delete (tombstone) |
| GET | `/customers`, `/providers` (y {id}, POST, PATCH, DELETE) | access | ✔ | Catálogo | CRUD igual a products |
| POST | `/orders` | access | ✔ | Finanzas | crear orden (pending o paid) |
| GET | `/orders` | access | — | Finanzas | listado/filtros |
| GET | `/orders/{id}` | access | — | Finanzas | detalle |
| PATCH | `/orders/{id}` | access | ✔ | Finanzas | editar pending |
| POST | `/orders/{id}/pay` | access | ✔ | Finanzas | pending→paid + invoiceNumber |
| POST | `/orders/{id}/void` | access | ✔ | Finanzas | paid→voided |
| POST | `/orders/{id}/cancel` | access | ✔ | Finanzas | pending→delete |
| POST | `/orders/{id}/kitchen` | `kitchen`+rol | ✔ | Cocina | enviar comanda a cocina/impresora (solo `kitchen` ON) — reservado F8 |
| POST | `/orders/{id}/kitchen-status` | `kitchen`+rol | ✔ | Cocina | actualizar `prepStatus` (new/sent/preparing/ready/served) — reservado F8 |
| POST | `/print-jobs` | access | ✔ | Print | crear PrintJob (idempotente; el retry de sync NO reimprime) — reservado F9 |
| POST | `/print-jobs/{id}/reprint` | access | ✔ | Print | reimpresión EXPLÍCITA (genera un job nuevo) — reservado F9 |
| POST | `/sync/push` | access | ✔ | Sync | lote de operaciones (≤500 ops / 4 MB); `opType='initial'` SOLO para bootstrap Modo B (PARTE 25) |
| GET | `/sync/pull` | access | — | Sync | cambios desde cursor (desde `since=null`: snapshot Modo A) |
| POST | `/backups/{businessId}` | access | ✔ | Backup | subir bundle |
| GET | `/backups/{businessId}` | access | — | Backup | listar metadata |
| GET | `/backups/{businessId}/{backupId}` | access | — | Backup | descargar bytes |
| DELETE | `/backups/{businessId}/{backupId}` | access (owner) | ✔ | Backup | soft-delete |
| GET | `/health` | — | — | Ops | healthcheck (liveness/readiness) |

---

## PARTE 31 — Contención de tamaño (diseñado, no implementado)

- Lotes bounded (Parte 19).
- **Foto/imágenes no viajan** en sync (`SYNC-STRATEGY §14`).
- Cursor incremental: solo cambios desde `since`.
- Pruning opcional de tombstones confirmados y movements `synced` antiguos (sin tocar Postgres ledger).
- Postgres: índices `(business_id, updated_at)` en catálogos, `orders(business_id, invoice_number)` UNIQUE,
  `sync_batches(request_id)` UNIQUE, `stock_movements(id)` PK.
- Órdenes grandes → snapshots grandes; retención local según la necesidad (tickets) — F7 si se requiere.

---

## PARTE 32 — Ejemplos JSON críticos (set mínimo del contrato)

### 32.1 Login

```json
POST /auth/login
{ "identifier": "admin@vende.lo", "password": "s3cret!", "deviceId": "dev-…", "deviceName": "Caja Central" }

200 OK
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs…",
  "refreshToken": "rt…opaco…",
  "user": { "id": "usr-…", "username": "admin", "email": "admin@vende.lo" },
  "businesses": [
    { "id": "business-abc…", "name": "Mi Negocio", "role": "owner",
      "businessType": "RESTAURANT",
      "capabilities": { "restaurant": true, "waiters": true, "tables": false, "kitchen": true, "kitchenPrinting": true },
      "capabilityVersion": 7 }
  ]
}
```

> `businesses[]` incluye el perfil básico de capacidades para que la UI configure sus selectores; el
> detalle completo se obtiene con `GET /businesses/{id}` o `GET .../capabilities`. Misma forma que
> `POST /auth/register` (PARTE 32.7).

### 32.2 Refresh

```json
POST /auth/refresh
{ "refreshToken": "rt…" }

200 OK
{ "accessToken": "eyJhbGciOiJIUzI1NiIs…", "refreshToken": "rt…nuevo…" }
```

### 32.3 Sync push (lote mínimo: 1 orden pagada + movimientos)

```json
POST /sync/push
{
  "requestId": "req-0001",
  "deviceId": "dev-…",
  "businessId": "business-abc…",
  "ops": [
    {
      "operationId": "ord-001", "entityType": "order", "entityId": "ord-001", "opType": "upsert",
      "payload": { "number": 7, "status": "paid", "paymentMethod": "cash", "receivedCents": 100000, "changeCents": 500, "subtotalCents": 99500, "items": [ { "productId": "hamburguesa", "name": "Hamburguesa", "quantity": 2, "unitPriceCents": 25000, "lineTotalCents": 50000 } ], "customer": { "name": "María", "phone": "", "address": "", "description": "" }, "customerName": "María", "customerPhone": "", "customerAddress": "", "customerDescription": "", "createdAt": "2026-09-21T10:00:00.000Z", "paidAt": "2026-09-21T10:00:01.000Z", "deviceId": "dev-…" }
    },
    { "operationId": "mov-001", "entityType": "movement", "entityId": "mov-001", "opType": "upsert", "payload": { "productId": "hamburguesa", "quantity": -2, "movementType": "SALE", "referenceId": "ord-001", "deviceId": "dev-…", "createdAt": "2026-09-21T10:00:01.000Z" } }
  ]
}

200 OK
{ "requestId": "req-0001", "serverTime": "…", "processed": true,
  "results": [ { "operationId": "ord-001", "status": "applied", "invoiceNumber": 1042 }, { "operationId": "mov-001", "status": "applied" } ],
  "cursor": "v1:eyJzZXEiOjg0fQ==" }
```

### 32.4 Sync pull

```json
GET /sync/pull?since=v1:eyJzZXEiOjg0fQ%3D%3D&limit=50&deviceId=dev-…

200 OK
{ "cursor": "v1:eyJzZXEiOjg0fQ==", "nextCursor": "v1:eyJzZXEiOjEwMH0=", "hasMore": true, "serverTime": "…",
  "changes": { "business": [], "products": [], "customers": [], "providers": [], "orders": [], "stockMovements": [], "cashClosures": [] } }
```

> Estructura idéntica a PARTE 14.3: `business` viaja en cada pull (cambios de capacidades/
> `capabilityVersion` incluidos).

### 32.5 Backup upload

```json
POST /backups/business-abc…
multipart/form-data
  metadata = { "app": "vendelo", "version": 1, "exportedAt": "2026-09-21T10:00:00.000Z", "originalSize": 123456 }
  file = <binary bundle v1>
Header X-Content-Sha256: a4b5c6…
Header X-Content-Size: 123456

201 Created
{ "backupId": "bk-…", "checksum": "a4b5c6…", "status": "stored" }
```

### 32.6 Recovery request

```json
POST /auth/recovery/request
{ "channel": "email", "address": "admin@vende.lo" }

202 Accepted
{ "message": "Si esa cuenta existe, recibirás un código para recuperar tu acceso." }
```

(genérico, no revela existencia)

### 32.7 Register (crea cuenta + negocio + membership + dispositivo en una transacción)

```json
POST /auth/register
{
  "identifier": "admin@vende.lo",
  "password": "s3cret!",
  "deviceId": "dev-…",
  "deviceName": "Caja Central",
  "businessId": "business-abc…",
  "name": "Mi Negocio",
  "ownerName": "Juan Pérez",
  "businessType": "RESTAURANT",
  "capabilities": { "restaurant": true, "waiters": true, "tables": false, "kitchen": true, "kitchenPrinting": true },
  "settings": { "invoice": { "prefix": "FAC" }, "currency": "DOP" }
}

201 Created
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs…",
  "refreshToken": "rt…opaco…",
  "user": { "id": "usr-…", "username": "admin", "email": "admin@vende.lo", "phone": null },
  "business": {
    "id": "business-abc…", "name": "Mi Negocio", "ownerName": "Juan Pérez",
    "businessType": "RESTAURANT",
    "capabilities": { "restaurant": true, "waiters": true, "tables": false, "kitchen": true, "kitchenPrinting": true },
    "settings": { "invoice": { "prefix": "FAC" }, "currency": "DOP" },
    "capabilityVersion": 1,
    "createdAt": "…", "updatedAt": "…"
  },
  "membership": { "id": "membership-…", "businessId": "business-abc…", "userId": "usr-…", "role": "owner" }
}
```

| Campo de request | Tipo | Obligatorio | Regla |
|---|---|---|---|
| `identifier` | string | **sí** | email válido O teléfono (p. ej. E.164 `+1809…`); máximo 1 por cuenta |
| `password` | string | **sí** | mínimo 8; Argon2/bcrypt en servidor; **nunca** el hash local PBKDF2 |
| `deviceId` | string | **sí** | el `deviceId` local de la app (X-Device-Id) |
| `deviceName` | string | **sí** | nombre visible del dispositivo |
| `businessId` | string ≤64 | no | id local de `@vendelo/business`; si se omite, el servidor genera |
| `name` / `ownerName` | string | `name` **sí** | nombre del negocio inicial |
| `businessType` | enum P.40.1 | no | default `COMMERCE`; informativo, no autoriza |
| `capabilities` | objeto P.40.2 | no | default OFF; **solo el bootstrap del dueño** puede activarlas en el mismo paso |
| `settings` | objeto P.40.3 | no | `invoice.prefix`, `currency` |

**Transacción atómica (una unidad):** create `users` → `memberships(user, business, role='owner')` →
`businesses` (con `capabilities`/`settings`/`capability_version=1`) → `devices(role='admin')` →
`devices_sessions` → emisión de tokens. Si algo falla, **rollback total** (no queda cuenta sin negocio).

**Duplicados:** mismo `identifier` → `409 CONFLICT` con mensaje genérico (sin revelar qué dato existe);
mismo `requestId` → respuesta original (idempotencia, no duplica).

**Compatibilidad (app actual):** la app hoy no pide email/teléfono (G13/G5/G8). El registro remoto los
exige; la app existente conserva `email`/`phone` nulos hasta que el usuario complete la cuenta (F4),
sin afectar operación offline. Probar con el backend cuerpo a cuerpo: nunca enviar `passwordHash`/
`passwordSalt` (P.5).

### 32.8 Create business (usuario autenticado, negocio adicional)

```json
POST /businesses
{ "businessId": "business-xyz", "name": "Segundo Negocio", "ownerName": "Ana",
  "businessType": "COMMERCE",
  "capabilities": { "restaurant": false, "waiters": false, "tables": false, "kitchen": false, "kitchenPrinting": false } }

201 Created
{ "business": { "id": "business-xyz", "name": "Segundo Negocio", "businessType": "COMMERCE",
    "capabilities": { "restaurant": false, "waiters": false, "tables": false, "kitchen": false, "kitchenPrinting": false },
    "settings": { "currency": "DOP" }, "capabilityVersion": 1, "createdAt": "…", "updatedAt": "…" },
  "membership": { "id": "membership-…", "businessId": "business-xyz", "userId": "usr-…", "role": "owner" } }
```

### 32.9 Patch capabilities (cambio de capacidades con versión optimista)

```json
PATCH /businesses/business-abc/capabilities
{ "expectedCapabilityVersion": 7,
  "businessType": "RESTAURANT",
  "capabilities": { "restaurant": true, "waiters": true, "tables": true, "kitchen": true, "kitchenPrinting": true },
  "settings": { "invoice": { "prefix": "FAC" }, "kitchenPrinters": ["dev-imp-01"], "currency": "DOP" } }

200 OK
{ "id": "business-abc", "name": "Mi Negocio", "businessType": "RESTAURANT",
  "capabilities": { "restaurant": true, "waiters": true, "tables": true, "kitchen": true, "kitchenPrinting": true },
  "settings": { "invoice": { "prefix": "FAC" }, "kitchenPrinters": ["dev-imp-01"], "currency": "DOP" },
  "capabilityVersion": 8, "createdAt": "…", "updatedAt": "…" }

409 Conflict (si el valor esperado no coincide)
{ "error": { "code": "VERSION_MISMATCH", "message": "La configuración cambió; recarga y reintenta.",
  "requestId": "…", "details": { "current": 8, "expected": 7 } } }
```

---

## PARTE 33 — Matriz de reglas de negocio (resumen)

| Módulo | Regla | Consecuencia de violación |
|---|---|---|
| Órdenes | `pending` editable; `paid`/`voided` inmutables | `409 INVALID_STATE` |
| Órdenes | `paid→voided` requiere `voidReason` | `400 VALIDATION_ERROR` |
| Órdenes | `invoiceNumber` asignado una vez | duplicado → `409 CONFLICT` (excepto dedupe) |
| Catálogo | LWW por `updatedAt` | se aplica silenciosamente (documentado) |
| Catálogo | tombstones ganan para siempre | B re-pull y aplica baja |
| Stock | `apertura + Σ movimientos`; sobreventa → flag (no rechazo) | nunca se pierde una venta |
| Cierres | inmutables | `409 CONFLICT` |
| Movimientos | append-only, idempotentes por id | `skipped_duplicate` |
| Sync | lote ≤500 ops/4MB; requestId único | `413` / `409` (replay) |
| Backups | checksum obligatorio | `400 CHECKSUM_MISMATCH` |
| Auth | genérico anti-enumeración + rate-limit | `429 RATE_LIMITED` |
| Auth | refresh rotación + revocación por changeEpoch | sesión muerta → re-login |
| Capacidades | OFF = oculto en UI y `403 FEATURE_DISABLED` en servidor | 403 con `details.capability` |
| Capacidades | desactivar NO borra datos; drenaje de pendientes permitido | — |
| Capacidades | `capabilityVersion` sube con cada cambio y viaja en `Business` | dispositivos refrescan caché |
| Restaurante | `waiters` ON ⇒ `waiterId` + (mesa O cliente) | `400 anonymous_order` |
| Restaurante | `paid`/`voided` siguen inmutables con o sin capacidades | `409 INVALID_STATE` |

---

## PARTE 34 — Matriz de HTTP status

| Status | Uso |
|---|---|
| 200 | OK (detalle, listados, pull, push procesado, downloads, login, refresh) |
| 201 | creado (negocio, producto, orden, backup, register) |
| 202 | recovery request (siempre genérico) |
| 204 | sin contenido (logout, change-password, delete soft) |
| 400 | validación, malformed, `INVALID_CURSOR`, `CHECKSUM_MISMATCH` |
| 401 | token faltante/inválido/expirado |
| 403 | no miembro / dispositivo revocado / permisos / **`FEATURE_DISABLED`** (capacidad OFF) |
| 404 | no encontrado (no revela existencia) |
| 409 | conflicto/duplicado no idempotente, `INVALID_STATE`, inmutabilidad, `VERSION_MISMATCH` |
| 413 | payload excede límites |
| 429 | rate-limit (`Retry-After`) |
| 500 | error interno |
| 503 | no disponible/mantenimiento (`Retry-After`) |

---

## PARTE 35 — Overengineering: lo que NO se hará

1. No microservicios, colas ni workers para el scope actual.
2. No GraphQL, no WebSockets.
3. No event-sourcing (el ledger de movimientos YA ES el event-sourcing necesario).
4. No tabla de "sync ins y diffs" manual; el cursor + upsert natural basta.
5. No reescribir la parte de auth de la app; se **añade** capa remota.
6. No sync en vivo por dispositivo; solo lote + snapshot.
7. No servidor síncrono de "ventas en vivo" obligatorio (los endpoints directos de órdenes existen
   como camino acelerado, no como requisito).
8. No cifrado cliente en v1 de backups si complica la entrega; se agenda a F5.
9. No multi-moneda, no impuestos, no promociones: OUT OF SCOPE.
10. No reintento automático infinito; backoff exponencial + manual en UI.

---

## PARTE 36 — Comparación con BACKEND-AUDIT y SYNC-STRATEGY (contradicciones)

### 36.1 Diferencias y su justificación (doc → contrato)

| Tema | BACKEND-AUDIT / SYNC-STRATEGY | API-CONTRACT | Justificación |
|---|---|---|---|
| Base path | `/api/...` | `/api/v1/...` | versionado explícito (aditivo) |
| PK catálogo | id global | `(business_id, id)` | resuelve semillas fijas §23-10 |
| Tabla stock | `stock_events` (futuro) | `stock_movements` (ya existe en la app) | alinear con el código real |
| Primer sync | GET /sync?since (Modo B recomendado) | `POST /sync/push` con `opType='initial'` (snapshot) mantiene el espíritu | elegimos "snapshot atómico" explícito (P.25; se eliminó `/sync/initial`) |
| Restore | SYNC vs RESTORE | Parte 18.4 (idéntico) | consenso |
| `invoiceNumber` | §20 nota "número de factura global" | Parte 11 detallado | — |
| Closures | BackUpps/AsyncStorage | Parte 13 (define entidad, no toca async) | migración F3/F4 |
| Auth recovery | §17 ≤10 min código | Parte 20 (idéntico) | consenso |
| Capacidades/Roles | no existían (era POS de mostrador) | PARTES 40–48 (integración F2.2) | derivado de `docs/CAPABILITIES-AUDIT.md` (semilla en F2.1) |
| Tiempo real | fuera de scope (solo REST) | Parte 46 (SignalR evaluado; no sustituye sync) | consenso |

### 36.2 Contradicciones encontradas

1. **`SYNC-STRATEGY §2` (FASE 0.5) decía "sin `updatedAt`/`deletedAt` en orders"** → **resuelto** en FASE 1.1
   (verificado: `orders.updated_at`, `orders.deleted_at` en SQLite y modelo). No es contradicción activa.
2. **`BACKEND-AUDIT §21` PK global de productos vs "ids fijos de semillas"** → resuelto por `(business_id, id)`.
3. **`BACKEND-AUDIT §20` y §5 recomendaban conservar `number` local como FAC** → el contrato lo mantiene y
   añade `invoiceNumber` global asignado por servidor (mejora, no rompe).
4. **`SYNC-STRATEGY §8` nombre de tabla `sync_batches`** → se adoptan `sync_batches` y `recovery_codes`
   exactos (consenso).
5. **`BACKEND.md` (doc existente)** menciona "no pointers a desync" — no contradicción, coincide.
6. **F2.2 (integración C1–C14):** el modelo de capacidades/roles/restaurante se añade al contrato de
   forma **aditiva** (campos opcionales `default OFF/NULL`) sin contradecir lo ya acordado en este
   contrato ni en `CAPABILITIES-AUDIT.md`; listado completo en PARTE 48.
7. **F2.2-B (cierre de observaciones):** los hallazgos H1, M1–M5 y LOW relevantes de
   `CONTRACT-AUDIT.md` quedan resueltos en este contrato (PARTES 6.1–6.2, 14.2, 25, 32.7–32.9, 37, 41.5,
   43.5, 44, 45.4; ver PARTE 49). Los INFO I1–I3 quedan como futuros, sin contradicción activa.

No hay contradicciones **bloqueantes** entre el contrato y los documentos existentes; hay evolución
justificada y alineada con el código real.

---

## PARTE 37 — Decisiones explícitas (31)

| # | Decisión | Elección | Nota |
|---|---|---|---|
| 1 | Prefix de rutas | `/api/v1` | aditivo |
| 2 | Autenticación | JWT 15 min + refresh hasheado/rotativo ligado a dispositivo | F3 |
| 3 | Identidad de cuenta | email o teléfono (al menos uno) | **GAP**: app no lo pide hoy (G8) |
| 4 | Password server | Argon2/bcrypt; no reutiliza KDF local | — |
| 5 | Números de factura | `invoiceNumber` secuencial por negocio asignado por servidor | resuelve FAC |
| 6 | IDs | cliente-generados en datos operativos; servidor solo en ids propios | — |
| 7 | Cursor | opaco `v1:` con seq+checksum; `INVALID_CURSOR` → resync | — |
| 8 | Idempotencia | `requestId` (transporte) + claves naturales (datos) | tabla `sync_batches` |
| 9 | Catálogo conflictos | LWW por `updatedAt`, tie por id; tombstones ganan siempre | — |
| 10 | Órdenes conflictos | guardas de transición + version; nunca LWW | — |
| 11 | Stock | apertura + Σ movimientos; sobreventa se marca, no se rechaza | — |
| 12 | Cierres | inmutables, por dispositivo; migración AsyncStorage→SQLite F3/F4 | GAP |
| 13 | Primer sync | snapshot inicial atómico (Modo B) o snapshot pull (Modo A) | — |
| 14 | Nuevo teléfono | RESTORE (backup) como bootstrap; sync incremental después | — |
| 15 | Backups | bundle v1 opaco; checksum SHA-256; cifrado cliente en F5 | — |
| 16 | Rate limiting | auth/sync/backups por IP+cuenta+dispositivo | — |
| 17 | Multiusuario | User→Membership→Business; **roles vigentes: `owner`, `admin`, `cashier`, `waiter`, `kitchen`, `printer`** (PARTE 41.2); membresías y roles entran en F3/F4; dispositivos con `role` propio (PARTE 7); **rol efectivo = membresía ∩ dispositivo** (PARTE 41.5) — el dispositivo NUNCA amplía privilegios | — |
| 18 | Movimientos fuera de snapshot | no replay histórico; `apertura = stock` del snapshot | evita doblar stock |
| 19 | `items[].productId` | requerido en contrato; derivación en la app sin migración | GAP→F4 |
| 20 | `imageUri`/fotos | NO viajan en sync | F8 o nunca |
| 21 | Modelo de capacidades | híbrido: `businessType` (informativo) + `capabilities` (flags) + `settings` (parámetros) + `capabilityVersion` (caché) | integrado F2.2 |
| 22 | Capacidades de restaurante | `restaurant`/`waiters`/`tables`/`kitchen`/`kitchenPrinting`, DEFAULT OFF, independientes | — |
| 23 | Mesero | = `userId` con rol `waiter` (membresía); `waiterName` es snapshot de ticket | nunca texto libre |
| 24 | Credenciales del personal | opción **A**: usuario + contraseña por miembro (reset/revoke por el dueño; `changeEpoch` invalida sesiones); opcional C: código de invitación para vincular dispositivos | decisión del propietario |
| 25 | Regla anti-anónima | `waiters` ON ⇒ `waiterId` + (mesa O cliente) | `400 anonymous_order` |
| 26 | Comanda vs factura | `prepStatus` (cocina) ortogonal a `status` (financiero); la Order es fuente de verdad | — |
| 27 | Impresión | `PrintJob` idempotente; retry NO reimprime; reimpresión = operación explícita | — |
| 28 | Tiempo real | SignalR solo notificaciones (F10); el sync persiste y recupera | — |
| 29 | Primer subida de datos locales (adopción de cuenta) | Única vía: `POST /sync/push` con `opType='initial'` (Modo B); **no existe `/sync/initial`**; snapshots de pull solo vía `since=null` (Modo A); restore vía backup NO reenvía `initial` | cierra M1 |
| 30 | Rol efectivo | `effectiveRole = membresía ∩ dispositivo`; el dispositivo nunca amplía; el servidor arbitra al operar/sincronizar; re-login/refresh propaga cambios de rol | cierra M4 |
| 31 | Registro de cuenta | `POST /auth/register` con `identifier` (email O teléfono, al menos uno), `password`, `deviceId`/`deviceName`, `businessId` opcional, `businessType`/`capabilities`/`settings` opcionales; transacción user+membresía(owner)+business+device+sessión; duplicados → `409 CONFLICT` genérico | cierra H1 |

---

## PARTE 38 — Pendientes de fases futuras (explícito, SIN implementar)

- **[F3]** Backend ASP.NET Core + PostgreSQL (Auth, Business, Devices, Catalog, Orders, Inventory, Cash,
  Sync, Backups, Recovery) según este contrato; incluye `businessType`/`capabilities`/`settings`/
  `capability_version`, `memberships.role`, `devices.role`, `FEATURE_DISABLED`, campos opcionales de
  orden, **`POST /auth/register` completo (P.32.7)** y magnitudes de `POST /businesses` y
  `PATCH .../capabilities` (P.6.1–6.2). La cuenta remota requiere email/teléfono (G13).
- **[F3.1]** Auditoría del backend (estructura, PostgreSQL, migraciones, índices, transacciones, errores, CORS).
- **[F4]** Autenticación server: usuarios, memberships, roles, JWT, refresh, logout, autorización, multitenancy.
- **[F4.1]** Auditoría de seguridad (IDOR, permisos, isolation, rate limiting, tokens, logs).
- **[F5]** Sync backend: push/pull, cursor, snapshot, idempotencia (`requestId`/`operationId`/batches),
  conflictos, tombstones, LWW catálogo, no-LWW órdenes.
- **[F5.1]** Conectar React Native ↔ API (offline-first intacto; SQLite local sigue siendo primario).
- **[F5.2]** Auditoría sync: duplicados, retries, offline, reconexión, multi-dispositivo, cursor, snapshots.
- **[F6]** Multi-dispositivo: registro/identidad/autorización de dispositivos, membresías, sync por
  dispositivo, roles `admin`/`cashier`/`waiter`/`kitchen`/`printer`.
- **[F7]** Capacidades del negocio visibles: UI solo muestra lo activado; backend aplica `FEATURE_DISABLED`;
  `capabilityVersion` propaga cambios; desactivar no borra datos.
- **[F8]** Comandas/meseros (WAITER, `waiterId`, pending orders, `tableId`/`customerId`, events, regla anti-anónima).
- **[F8.1]** Cocina: `KitchenTicket`, `prepStatus`, nueva/actualizar/cancelar comanda (la Order es la fuente de verdad).
- **[F9]** Impresión: `PrintJob`, configuración, routing básico, idempotencia, retry seguro, reimpresión explícita.
- **[F10]** Tiempo real (SignalR): notificaciones rápidas mesero→cocina; sync como mecanismo de recuperación.
- **[F11–F19]** Restaurante completo, reportes, impresoras avanzadas, requisitos fiscales (RD), planes,
  hardening, piloto, Android/Google Play, iOS/TestFlight.
- **[F5 (backups)]** Cifrado cliente de backups con clave derivada del password.
- **[F7 (operativo)]** Compactación de tombstones, pruning de movimientos históricos, `conflict_log`, archive de órdenes.

---

## PARTE 39 — Validación de la fase (solo lectura)

- `npm test` → **35 suites / 298 tests PASS** (ejecutado al inicio de F2 y re-verificado en F2.2/F2.2-B).
- `npx tsc --noEmit` → **sin errores** (sin cambios de código desde F2).
- `npx expo-doctor` → **21/21 checks passed**.
- Sin modificaciones al código, sin nuevos paquetes, sin commit, sin push.
- Archivos de esta fase: **`docs/API-CONTRACT.md`** (integración F2.2, C1–C14 y cierre F2.2-B).

---

## PARTE 40 — Capacidades del negocio (C1–C3, C11)

### 40.1 `businessType` (informativo, nunca controla permisos)

```ts
businessType: 'COMMERCE' | 'RESTAURANT' | 'FOOD_TRUCK' | 'MOBILE_VENDOR' | 'SERVICE' | 'OTHER';
```

- Solo para onboarding/preset, etiquetado e informes. La autorización depende de `capabilities` (40.2).

### 40.2 `capabilities` (los interruptores reales)

```ts
// DEFAULT: todas OFF → POS simple idéntico para todo negocio.
type BusinessCapabilities = {
  restaurant?: boolean;      // contenedor UX (no autoridad; la autoridad son los sub-flags)
  waiters?: boolean;         // órdenes tomadas por mesero (waiterId)
  tables?: boolean;          // asociar órdenes a mesas
  kitchen?: boolean;         // flujo de preparación (comandas / KitchenTicket)
  kitchenPrinting?: boolean; // envío de comandas a impresora de cocina
  // Futuras (reservadas): delivery, reservations, branches, shifts, services…
};
```

Reglas:
1. Capacidad = clave booleana independiente; añadir una futura no toca el núcleo.
2. `restaurant` es agrupación UX; `waiters`/`tables`/`kitchen`/`kitchenPrinting` son la autoridad.
3. `tables` no exige `waiters` (combinaciones permitidas, documentadas).
4. **OFF = UI oculta + servidor `403 FEATURE_DISABLED`** (Parte 22.2).

### 40.3 `settings` (parámetros de capacidades activas)

```ts
type BusinessSettings = {
  invoice?: { prefix?: string };      // p. ej. "FAC"
  kitchenPrinters?: string[];         // deviceIds de impresoras de cocina
  currency?: 'DOP';
};
```

- Solo relevantes si su capacidad está ON; si está OFF se ignoran.

### 40.4 `capabilityVersion`

- Entero, parte de `Business`; **sube en cada cambio** de `capabilities`/`settings` (también `updatedAt`).
- Viaja en el `Business` (Tier 1 LWW) por `/sync/pull` → los dispositivos comparan su caché y refrescan.
- **Concurrencia:** `PATCH /businesses/{id}/capabilities` exige `expectedCapabilityVersion`; si difiere
  → `409 VERSION_MISMATCH` (PARTE 6.2). Evita que dos admins se pisen un cambio sin leer.

### 40.5 Caché offline de capacidades

- La app guarda el `Business` local (hoy AsyncStorage; GAP→F4 mover a SQLite). La UI consulta la
  caché (selector único, nunca `businessType`). Operar offline según caché; el servidor arbitra al
  sincronizar.

### 40.6 No-destrucción y drenaje

- Desactivar una capacidad **no borra** nada (órdenes, mesas, meseros, tickets, historial, settings).
- Bloquea solo CREACIÓN de nuevas operaciones. Las pendientes se **drenan**: cerrarlas/entregarlas/
  anularlas sigue permitido; reactivar restaura todo (ver PARTE 42.4 y 43.4).

---

## PARTE 41 — Roles y membresías (C4–C5, C10)

### 41.1 Miembros (multi-tenant)

```text
users ──<memberships(business_id, user_id, role, active, created_at, updated_at)>──> businesses
```

- Composiciones aditivas del contrato existente (Parte de multi-tenancy).
- `membershipId` lo genera el servidor; `role` lo asigna `owner`/`admin`.

### 41.2 Roles

| Rol | Alcance |
|---|---|
| `owner` | todo + configurar capacidades + gestión de miembros/dispositivos |
| `admin` | mismo que owner (si el negocio lo permite), sin ciertas acciones contables (opcional) |
| `cashier` | POS, caja, inventario, clientes; sin configurar capacidades |
| `waiter` | crear y gestionar SUS órdenes (mesa/cliente); sin caja |
| `kitchen` | ver/actualizar comandas (`prepStatus`), reimpresión de cocina |
| `printer` | consumir cola de impresión (solo envío/reimpresión autorizada) |

### 41.3 Matriz rol × capacidad (referencia)

| Capacidad | owner | admin | cashier | waiter | kitchen | printer |
|---|---|---|---|---|---|---|
| POS / caja / inventario | ✔ | ✔ | ✔ | ✘ | ✘ | ✘ |
| Crear órdenes de mesero | ✔ | ✔ | ✔ | ✔ (solo suyas) | ✘ | ✘ |
| Mesas (`tables`) | ✔ | ✔ | ✔ | ✔ | ✘ | ✘ |
| Cocina (`kitchen`) | ✔ | ✔ | ✘ | ✘ | ✔ | ✘ |
| Impresión cocina | ✔ | ✔ | ✘ | ✘ | ✔ | ✔ |
| Configurar capacidades | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ |

El **servidor** aplica esta matriz sobre el `role` del token + `business.capabilities`.
El `device.role` (Parte 7) puede restringir aún más (p. ej. un dispositivo fijo de cocina).

### 41.4 Gestión de personal (alta/baja/cambio de credenciales)

- **Alta:** `POST /businesses/{id}/members` con `{ username, password, role }` (el mesero recibe sus
  credenciales; opción A decidida por el propietario).
- **Baja:** `PATCH /businesses/{id}/members/{userId}` → `active: false` + revoke de dispositivos.
  El historial del mesero permanece (órdenes, tickets, cierres) con `waiterName` congelado.
- **Cambio de credenciales:** reset de contraseña → `users.changeEpoch++` invalida todas sus sesiones
  al instante.
- **Reactivar** el miembro restaura el acceso (no-destrucción).
- Nunca se envían `passwordHash`/`passwordSalt` en la API (regla de seguridad).

### 41.5 Rol efectivo (precedencia membresía vs dispositivo)

**Definición:** el rol que autoriza una operación es la **intersección de permisos** del rol de la
membresía y del rol del dispositivo:

```text
effectiveRole = intersección(permisos(membership.role), permisos(device.role))
```

Equivalente práctico (matriz PARTE 41.3): una operación es permitida **solo si** está marcada ✔ para
`membership.role` **y** ✔ para `device.role`.

**Casos:**

| Escenario | Resultado |
|---|---|
| Dispositivo con más permisos que el usuario (ej. device `admin`, miembro `waiter`) | Opera como `waiter` (el dispositivo NO amplía) → evita escalamiento accidental |
| Usuario con más permisos que el dispositivo (ej. miembro `owner`, device `printer`) | Opera como `printer` (ej. terminal fija de cocina) |
| Roles iguales | Rol único |
| Dispositivo `*`/sin rol explícito (legado) | Se asume suficiente para el rol de la membresía (compat) |

**Operación y autorización:** cada endpoint consulta `effectiveRole` (cache corta por `capabilityVersion`
y por membresía) y la matriz. El claim JWT `role` = `membership.role`; el servidor calcula la
intersección con `devices.role` (el rol del dispositivo NO viaja como autoridad en el token, solo como
restricción).

**Sincronización y cambios:** los cambios de `membership.role` se propagan con el próximo `login`/
`refresh` (nuevo token). Si un rol se degrada mientras el dispositivo está offline, la UI puede seguir
mostrando el rol cacheado hasta el próximo refresh; el **servidor** aplica la degradación en la primera
operación/sync posterior (`403 FORBIDDEN` si ya no alcanza). Un miembro desactivado queda `FORBIDDEN`
en su próximo access/refresh.

**Cambio de dispositivo (mismo usuario):** cada dispositivo se registra con su propio `deviceId` y
recalcula `effectiveRole` en su login. Revocar el dispositivo (PARTE 7) lo bloquea sin tocar la membresía.

---

## PARTE 42 — Órdenes de restaurante: meseros y mesas (C6, C8)

Regla ya integrada en PARTE 10.1. Resumen operativo:

1. Capacidad `waiters` ON → el mesero (usuario con rol `waiter`) crea la orden con
   `orderType='waiter'`, `waiterId` (obligatorio) y `waiterName` (snapshot de ticket).
2. Capacidad `tables` ON → `tableId`/`tableName` opcionales.
3. Regla anti-anónima (PARTE 10.1): `waiterId` **y** al menos uno de (`tableId`/`tableName`,
   `customerId`, `customer.customerName`). `400 anonymous_order` si se incumple.
4. `Member/device` revocado no puede crear órdenes de mesero.
5. `waiters` OFF + intento de `orderType='waiter'` → `400 VALIDATION_ERROR` (cliente) / `403` (server).
6. Los `stock_movements` y el cierre de caja NO cambian: una venta de mesero descuenta igual al pagar.
7. **Comanda pendiente ≠ pagada:** una orden de mesero vive en `pending` (comanda) mientras se
   prepara/sirve; solo `paid` es venta/factura (PARTE 44). `kitchenTicketId` opcional identifica la
   comanda emitida (PARTE 43).
8. **Edición tras envío a cocina:** `PATCH /orders/{id}` solo si `pending` y `prepStatus ∈ {new,
   undefined}`; si ya `sent+` → `409 INVALID_STATE` (cancelar y recrear, PARTE 43.4).

---

## PARTE 43 — Cocina: KitchenTicket y prepStatus (F8.1, diseño)

### 43.1 Concepto

- Una orden enviada a cocina produce un **`KitchenTicket`** (comanda). La **`Order` es la fuente de
  verdad**; el ticket es una vista derivada, no un documento independiente.
- `kitchen` ON habilita `prepStatus` en la orden y los endpoints `/orders/{id}/kitchen*`.

### 43.2 `prepStatus` (track de preparación, ortogonal al pago)

```
new → sent → preparing → ready → served
```

- `new`: comanda creada; `sent`: enviada a cocina; `preparing`: en elaboración; `ready`: lista;
  `served`: entregada al cliente.
- Independiente de `status` financiero (`pending → paid → voided`): una orden puede estar `served`
  antes de `paid`, y una comanda puede ir a cocina sin estar pagada (PARTE 44).

### 43.3 `KitchenTicket` (forma)

```json
{
  "id": "kt-…",
  "orderId": "ord-…",
  "businessId": "business-abc…",
  "tableName": "Mesa 12",
  "waiterId": "usr-carlos…",
  "waiterName": "Carlos",
  "items": [ { "productId": "hamburguesa", "name": "Hamburguesa", "quantity": 2, "note": "sin cebolla" } ],
  "prepStatus": "preparing",
  "createdAt": "2026-09-21T10:00:03.000Z",
  "updatedAt": "2026-09-21T10:05:00.000Z"
}
```

### 43.4 Operaciones permitidas

| Operación | Quién | Regla |
|---|---|---|
| `POST /orders/{id}/kitchen` (enviar comanda) | rol autorizado | idempotente (mismo `operationId` no duplica ticket) |
| `POST /orders/{id}/kitchen-status` (new/sent/preparing/ready/served) | `kitchen`/`owner`/`admin` | transiciones ordenadas; fuera de orden → `409 CONFLICT` |
| Cancelar comanda | `kitchen`/`owner`/`admin` | si la orden sigue `pending` → `cancel` (tombstone); la impresión ya realizada NO se deshace |
| Cocina pierde conexión | — | recupera por `/sync/pull` (PARTE 46/47); SignalR es solo acelerador |

- Desactivar `kitchen` con comandas abiertas: **drenaje** — se pueden completar/anular las existentes,
  no crear nuevas (PARTE 40.6).

### 43.5 Relación Order ↔ KitchenTicket (no segunda fuente de verdad)

1. **La `Order` es la única fuente de verdad.** El `KitchenTicket` es una **vista/deployable** de la
   orden (o de parte de sus items) para el flujo de cocina.
2. **Creación:** `POST /orders/{id}/kitchen` genera el ticket y asigna `order.kitchenTicketId` (opcional,
   id generado por el cliente de la petición, P.2) y pone `prepStatus='sent'`. Idempotente: mismo
   `operationId` no crea duplicado.
3. **Actualización:** `POST /orders/{id}/kitchen-status` cambia `prepStatus` de la **Order**; el ticket
   (derivado) la refleja. NO hay columna `prepStatus` en el ticket como estado independiente.
4. **Cancelación:** cancelar la comanda (`pending` → tombstone) cancela el ticket; la impresión ya
   realizada no se deshace (reimpresión manual si procede, P.45).
5. **Modificación:** tras `sent+` no se editan items por API (P.10.1); en cocina solo estados + nota.
6. **Sincronización:** el ticket **no viaja como bucket propio** en `/sync/pull`. Los dispositivos de
   cocina reciben las `orders` (con `prepStatus`/`kitchenTicketId`) y **materializan** el ticket
   localmente. Al reiniciar o perder conexión, re-materializan desde el pull (recuperación natural).
7. **Sin cargas totales:** restaurar un teléfono (P.18.4) restaura las órdenes; los tickets se
   reconstruyen por derivación.

---

## PARTE 44 — Comanda vs Factura (ciclo de vida separado)

```text
CORE (financiero):        pending → paid → voided        (inmutable al pagar)
PREP (solo kitchen ON):   new → sent → preparing → ready → served   (ortogonal)
```

**Mapeo de estados "ideales" a la representación del contrato** (una orden puede estar `READY` sin
estar `PAID`; el pago es independiente de la cocina):

| Ideal | Representación contrato |
|---|---|
| `DRAFT` | `status='pending'` sin enviar a cocina (`prepStatus` ausente / `new`) — comanda editable |
| `PENDING` | `status='pending'` (comanda; pendiente de pago) |
| `SENT_TO_KITCHEN` | `status='pending'` + `prepStatus='sent'` + `kitchenTicketId` asignado |
| `PREPARING` | `status='pending'` + `prepStatus='preparing'` |
| `READY` | `status='pending'` + `prepStatus='ready'` (**puede seguir sin pagar**) |
| `SERVED` | `status='pending'` + `prepStatus='served'` |
| `PAID` | `status='paid'` + `invoiceNumber` (la cocina puede haber terminado o no) |

`status` (financiero) y `prepStatus` (preparación) **nunca se mezclan en una sola transición**.

| Aspecto | COMANDA (`status=pending` + `prepStatus`) | FACTURA (`status=paid`) |
|---|---|---|
| `subtotalCents` | congelado desde la creación | igual, congelado |
| `invoiceNumber` | no asignado | asignado por el servidor (Parte 11) |
| `stock_movements` | NO se generan al crear | SALE al pagar (puede confirmarse antes con ajuste si se descuenta stock al enviar a cocina — criterio de negocio, reservado) |
| Cierre de caja | no cuenta | cuenta por `paidAt` |
| Impresión | comanda (cocina) | ticket/factura (caja) |

- Regla: el **pago** y la **preparación** son conceptos independientes; el contrato no los fusiona.
- El descuento de inventario al enviar a cocina (opcional) se documentará en F8.1 sin cambiar el núcleo:
  se modelaría como movimiento con `referenceId = orderId` y `movementType = 'KITCHEN_HOLD'`
  (reservado, NO implementado).

---

## PARTE 45 — Impresión: PrintJob y reimpresión (F9, diseño)

### 45.1 Modelo

```json
{
  "id": "pj-…",
  "businessId": "business-abc…",
  "deviceId": "dev-imp-01",
  "kind": "kitchen" | "ticket" | "invoice",
  "referenceId": "ord-…",
  "idempotencyKey": "req-print-…",
  "status": "QUEUED",
  "tries": 0,
  "createdAt": "…",
  "printedAt": null,
  "reason": null
}
```

### 45.2 Estados

```
QUEUED → PRINTING → PRINTED
   │         │
   └─ FAILED → RETRYING → PRINTING/CANCELLED
```

`QUEUED | PRINTING | PRINTED | FAILED | RETRYING | CANCELLED`.

### 45.3 Reglas

1. **Idempotencia:** `PrintJob.id` es natural y cada intento de impresión es idempotente por
   `operationId`/`idempotencyKey`. **El retry de sync NO reimprime** (si el job ya está `PRINTED`,
   se devuelve `skipped_duplicate`).
2. **Reimpresión = operación explícita:** `POST /print-jobs/{id}/reprint` crea **un job nuevo**
   (según `kind`), con su propio id; nunca reusa el job original.
3. Cola FIFO por `deviceId`; límite de reintentos con backoff (p. ej. 3); `CANCELLED` manual.
4. Un dispositivo `printer` consume su cola; el resto de dispositivos no la bloquea.
5. **Routing de impresoras** (Producto→Categoría de impresión→Impresora: hamburguesa→cocina,
   cerveza→bar, postre→postres) queda **reservado como complejidad futura** (F9/F13), NO en el
   contrato base: en v1 la comanda va a `settings.kitchenPrinters`.

### 45.4 Retry vs reimpresión (intención única) y generación del id

- **Retry técnico** (red/impresora caídas, `FAILED → RETRYING`): usa el **mismo `PrintJob` y el mismo
  `printJobId`** (`tries++`, backoff, límite 3; luego `CANCELLED` o espera manual). **Nunca crea una
  nueva intención de impresión** — si el job ya está `PRINTED`, un reenvío del sync devuelve
  `skipped_duplicate`.
- **Reimpresión manual** (`POST /print-jobs/{id}/reprint`): operación explícita que **crea un job
  nuevo**. Su id (`printJobId`) lo genera el **cliente** en el body:

  ```json
  POST /print-jobs/pj-original/reprint
  { "printJobId": "pj-re-…", "kind": "kitchen", "referenceId": "ord-…", "deviceId": "dev-imp-01",
    "reason": "reprint", "idempotencyKey": "req-reprint-…" }
  ```

  - `printJobId` obligatorio (cliente, P.2); mismo par `(printJobId, idempotencyKey)` → misma respuesta
    sin duplicar (idempotente).
  - El nuevo job entra **al final de la cola** FIFO de su `deviceId`; nunca reusa el estado del original.
  - `kind` puede variar del original (p. ej. reimprimir solo comanda de cocina).
- La **cola de impresión no viaja por `/sync/push|pull`**: es un estado local-por-dispositivo con
  registro en el servidor (F9 recupera/audita los `printedAt`/`FAILED`).

---

## PARTE 46 — Tiempo real (SignalR) (F10, evaluación)

### 46.1 Evaluación

- **Selección:** **SignalR** (ASP.NET Core) como solución natural para el stack backend.
- **Uso:** notificaciones/upserts rápidos `Mesero → Backend → Cocina` (nueva comanda, `prepStatus`,
  cancelación). No transporte de datos canónicos.
- **No sustituye sync:** si cocina pierde conexión, recupera todo por `/sync/pull`; la Order/SQLite
  local son la fuente de recuperación. El contrato de sync es independiente del transporte en tiempo real.

### 46.2 Hubs propuestos (reservados)

| Hub | Eventos |
|---|---|
| `kitchenHub` | `ticketCreated`, `ticketUpdated`, `ticketCancelled` |
| `ordersHub` | `orderPaid`, `orderVoided`, `orderUpdated` (si el negocio lo necesita) |

- Autorización: token de acceso en `negotiate`; hub suscrito por `businessId` (aislamiento de negocio);
- **Offline/LAN:** el tiempo real queda degradado a sync; no se bloquea operación.

---

## PARTE 47 — Offline (los tres escenarios)

| Escenario | Comportamiento del contrato (sin inventar nada) |
|---|---|
| 1. **Offline total** | Operación local 100 % en SQLite (ventas, comandas, ajustes). Pila de outbox (movimientos+tombstones+órdenes). Al reconectar → `/sync/push` + `/sync/pull`. |
| 2. **Red local sin Internet** | Impresión por red local/Bluetooth sí funciona (`printer` local). El sync en la nube queda en cola; entre dispositivos de la misma LAN **no** hay sync directo (sin inventar infraestructura); todo pasa por el servidor cuando hay Internet. |
| 3. **Internet disponible** | Sync incremental + SignalR (si el hub está operativo). |

Regla: la app NO depende de Internet; SQLite es el almacén de operación.

---

## PARTE 48 — Registro de integración F2.2 (C1–C14) y decisiones

### 48.1 C1–C14 aplicados

| Cambio | Dónde en este contrato |
|---|---|
| C1 Business con `businessType` | PARTES 6, 40 |
| C2 `BusinessCapabilities` | PARTE 40.2 |
| C3 `BusinessSettings` | PARTE 40.3 |
| C4 `devices.role` + POST /devices | PARTE 7 |
| C5 `memberships.role` | PARTE 41 |
| C6 Orden con campos opcionales | PARTES 10, 10.1 |
| C7 `OrderEvent` | PARTE 10 (ejemplo) |
| C8 Regla anti-anónima + validaciones de mesero/mesa | PARTES 10.1, 42 |
| C9 Error `FEATURE_DISABLED` | PARTES 22.2, 23 |
| C10 Autorización por capacidad (flag + rol) | PARTE 22.2 + 41.3 |
| C11 `capabilityVersion` con el Business en sync | PARTES 14, 40.4–40.5 |
| C12 Backups con `capabilities/settings/capabilityVersion` | PARTE 18 (envelope ganó campos opcionales) |
| C13 Esquema Postgres (futuro F3) | PARTES 30–31 + decisiones 21–28 |
| C14 Matriz roles × capacidades | PARTE 41.3 |

> Nota (C12): el bundle de backup v1 usa un envelope `{ app, version, exportedAt, business, … }`.
> Al añadir `capabilities/settings/capabilityVersion` dentro de `business` es retrocompatible: la app
> nueva restaura el Business completo; un restore nuevo guarda la configuración de capacidades intacta.

### 48.2 Decisiones operativas de esta integración

1. **Mesero = cuenta con usuario+contraseña (opción A),** creada por el dueño vía
   `POST /businesses/{id}/members`; alta/baja/reset/reinstalar-rol vía
   `PATCH .../members/{userId}`; el historial del mesero nunca se borra.
2. **Regla anti-anónima** aprobada: `waiterId` + (mesa O cliente).
3. **Comanda vs factura** aprobada: `prepStatus` ortogonal al pago; la Order es la fuente de verdad.
4. **Impresión idempotente** aprobada: retry no reimprime; reimpresión explícita.
5. **SignalR aprobado como evaluación futura** (F10); el sync persiste y recupera.
6. **Cancelar comanda** no deshace impresiones ya realizadas (se documenta; reimpresión manual si procede).

---

## PARTE 49 — Registro de cierre F2.2-B (observaciones de CONTRACT-AUDIT.md)

| ID | Estado | Solución en el contrato |
|---|---|---|
| H1 | RESUELTO | `POST /auth/register` completo: campos/tipos/obligatoriedad (P.32.7), transacción atómica user+membresía(owner)+business+device+sessión (P.6.1), respuesta con tokens + business + membership, duplicados `409`, nota de compatibilidad con la app actual (G13). |
| M1 | RESUELTO | Semántica única de bootstrap: **no existe `/sync/initial`**; Modo B = `POST /sync/push` con `opType='initial'` (P.14.2, P.25); Modo A = `GET /sync/pull?since=null`; restore NO reenvía `initial`; cursor inválido → reset pull (P.25). Tabla maestra P.30 sin `/sync/initial`. Decisión 29. |
| M2 | RESUELTO | P.32.4 ahora incluye `business` en `changes` (igual que P.14.3); nota de coherencia añadida. |
| M3 | RESUELTO | Decisión 17 actualizada a la arquitectura vigente (6 roles + membresías en F3/F4 + rol efectivo P.41.5); título P.37 corregido a 31 decisiones; nuevas decisiones 29–31. |
| M4 | RESUELTO | `effectiveRole = intersección(permisos(membership.role), permisos(device.role))` — P.41.5 con casos, autorización, sync/offline, cambio de rol y cambio de dispositivo. El dispositivo nunca amplía privilegios. |
| M5 | RESUELTO | Bodies completos de `POST /businesses` (P.6.1) y `PATCH .../capabilities` (P.6.2) + ejemplos P.32.8/32.9; `expectedCapabilityVersion` con `409 VERSION_MISMATCH` (P.23/34). `businessType` informativo; capabilities controlan; rol controla autorización. |

### LOW corregidos

| L | Corrección |
|---|---|
| L1 | Título P.37 "(20)" → "(31)" (coherente con 31 filas). |
| L2 | "Cancar" → "Cancelar" (P.48.2-6). |
| L3 | Terminología unificada a **sobreventa** (P.12, P.16-C7, P.24, P.33, P.37-11); "APIERRE < 0" reemplazado por redacción clara; `APIERRE_ERROR` reservado → `SEMANTIC_ERROR`. |
| L4 | Typos: "os dispositivos" → "Los dispositivos" (P.14.1); "solo o identidad que ES dueño" → "solo si la identidad es dueña" (P.6, P.30). |
| L5 | P.11.5 "modo B Parte 26" → "Modo B, PARTE 25". |
| L6 | `sync_batches` UNIQUE pasa a `(business_id, request_id)` (P.15, P.31), coherente con P.22#5. |
| L7 | `events[]`: quién escribe (cliente `created`; servidor `paid`/`voided`/`kitchenSent`/`prepStatusChanged`/`cancelled`) — P.10.1. |
| L8 | Refresh token aclarado: acceso 15 min, refresh activo 48 h, cadena 30 días — P.5.1. |
| — | Referencia "Ver PARTE 22" de recuperación → "Ver PARTE 20" (P.5.2). |

### LOW que permanecen (conscientemente, sin impacto para F3)

- L3 (residual): `SEMANTIC_ERROR` (422) sigue **reservado/sin uso** — no afecta F3.
- INFO I1 (switch de negocio), I2 (ids de print job en reimpresión — ahora resuelto en P.45.4),
  I3 (`KITCHEN_HOLD`) → decisiones futuras (F6/F8.1); sin contradicción activa.

### Verificaciones de no-regresión (secciones 13–24 del encargo)

- **Restaurante:** separación comanda vs factura mantenida (P.10.1, P.42, P.44); se añadieron `customerId`
  y `kitchenTicketId` (opcionales) y la regla de edición tras envío a cocina (P.10.1/42).
- **Estados de orden:** se añadió el mapeo DRAFT→PAID/READY-sin-PAID a la representación ya acordada (P.44).
- **KitchenTicket:** derivado, NO segunda fuente de verdad; sync por la Order; re-materialización local (P.43.5).
- **PrintJob:** retry nunca reimprime; reimpresión explícita con nuevo id del cliente (P.45.4).
- **Sync:** sin LWW en órdenes pagadas/movimientos/cierres (P.16 ya lo garantizaba); idempotencia y
  snapshot sin replay (P.12/25). Alineado con `SYNC-STRATEGY`.
- **Multitenancy/IDOR:** módulos sensibles enumerados con filtro obligatorio `(business_id, id)` (P.22#6).
- **Offline:** sin reglas que exijan Internet para vender (P.47); sobreventa flaggeada, nunca reescrita (P.12/24).
- **InvoiceNumber/Inventario/Cierres/Backups:** arquitectura vigente verificada y sin cambios (P.11/12/13/18/23).
- **Compatibilidad app:** ningún cambio de código requerido por esta fase; G13 documenta el único dato
  nuevo (email/teléfono) para F4.

---

## Validación de F2.2-B (ver PARTE 39)