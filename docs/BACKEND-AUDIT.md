# Vendelo App — Auditoría del proyecto actual (FASE 0)

> **Objetivo de este documento:** preparar el diseño de un backend **ASP.NET Core Web API + C# + PostgreSQL**
> a partir del código real de Vendelo, **sin implementar nada**. En esta fase NO se crea el backend,
> NO se crean tablas de PostgreSQL, NO se modifican IDs, autenticación, SQLite ni lógica de la app.
> Solo lectura del código y documentación de auditoría.

- **Fecha de auditoría:** 21/09/2026
- **Commit base:** `d32e79e` (Fases 0–19: auditoría técnica y endurecimiento del núcleo financiero)
- **Rama:** `main` (limpia, sincronizada con `origin/main`)
- **Proyecto:** React Native 0.86 / Expo SDK 57 / TypeScript 6 (estricto) / Jest (jest-expo)
- **Regla de retorno del proyecto:** si se retoma tras tiempo, leer `README.md` (guía de retorno) y `AGENTS.md` antes de escribir código.

---

## 1. Estado actual

Vendelo es una **app POS/facturación 100 % offline** para pequeños negocios (RD$, tickets, impresora):

- **Configuración del negocio + usuario** en el primer arranque (`SetupScreen`), login local, pregunta de
  seguridad para recuperar la contraseña en el mismo dispositivo.
- **Facturación** (catálogo, buscador, categorías, carrito, datos del cliente opcionales).
- **Órdenes:** guardadas (pending) y cobradas (paid), anulación (voided) con devolución de stock.
- **Inventario:** productos con stock, editable y ajustable; stock reservado/liberado según el estado de la orden.
- **Caja:** apertura con efectivo inicial y **cierre con registro inmutable** (desglose efectivo/transferencia).
- **Historial, clientes, proveedores, impresión** (sistema/Bluetooth/demo), **backup/restore** local por archivo.
- **Google Drive** dejado **dormido** (servicio intacto, `GOOGLE_CLIENT_ID = ''`, fuera de la UI).
- **31 suites de tests, ~258 tests, `tsc --noEmit` limpio, `expo-doctor` 21/21** al momento del último commit.

### Stack técnico verificado

- `package.json`: Expo `~57.0.24`, React Native `0.86.3`, React `19.2.3`, TS `~6.0.3`.
- Persistencia: `expo-sqlite` (Android/iOS), `@react-native-async-storage/async-storage`, `expo-secure-store`.
- Criptografía: `expo-crypto` (PBKDF2-HMAC-SHA256 implementado a mano, 100 000 iteraciones).
- Red: `expo-network` + `@react-native-community/netinfo` (detector de conectividad para Drive).
- Impresión: `expo-print` (sistema), `react-native-ble-plx` (Bluetooth, requiere dev build), `expo-file-system`,
  `expo-sharing`, `expo-document-picker` (backup), `expo-auth-session`/`expo-web-browser` (Drive dormido).

---

## 2. Arquitectura actual (estructura real)

La comunicación real es **Pantallas → Servicios → Repositorios → Capa de persistencia**, con dos capas de
persistencia distintas (no solo SQLite):

```
Pantallas (src/screens)
      ↓
Servicios (src/services)        setupService, orderService, cashRegisterService,
                                stockService, backupService, autoBackupService,
                                syncQueue, driveService (dormido), printerService
      ↓
Repositorios (src/repositories)  orderRepository, productRepository, customerRepository,
                                providerRepository  ← fachadas "lazy" con 2 implementaciones
      ├── SQLite (expo-sqlite)  *.native.ts   → Android / iOS
      └── Memoria (arrays)      *.ts          → web (y Jest)
      ↓
Persistencia
  ├── SQLite (micaja.db)            productos, órdenes, clientes, proveedores, order_meta
  ├── AsyncStorage                   negocio, caja abierta, cierres, config impresora, token Drive, cola
  └── SecureStore (Keychain/Keystore) usuario (hash/sal/pregunta de seguridad)
```

### Capas y puntos clave

- **Fachadas lazy** (`LazyOrderRepository`, etc.): eligen en runtime `SQLite` en Android/iOS y
  **memoria en web/tests** (`Platform.OS === 'web'`). Las pantallas no saben cuál se usa.
- **Transacciones inyectables** (`repositories/transaction.ts` | `transaction.native.ts`):
  `withTransaction(fn)` es passthrough en web/tests y `withTransactionAsync` real en SQLite.
  `orderService` ejecuta dentro de la transacción: guardar pendiente, cobrar, anular, cancelar,
  siempre con validación y reserva/liberación de stock en el mismo lance (rollback completo si algo falla).
- **Singleton de servicio de órdenes**: `orderService` se crea con `orderRepository` + `productRepository` por defecto;
  los tests inyectan repositorios en memoria.
- **Estado de la caja y cierres NO viven en SQLite**: `@micaja/cashRegister` (caja abierta),
  `@micaja/cashClosures` (array de cierres) en AsyncStorage.
- **El usuario NO viven en SQLite**: SecureStore (`vendelo.user`), con fallback/migración de AsyncStorage.

### Flujo de arranque real (App.tsx)

```
BootGate: splash → isSetupDone()?
   ├─ false → SetupScreen (configura negocio + usuario) → Login
   ├─ true + authed=false → LoginScreen (login o "¿Olvidaste tu contraseña?")
   └─ true + authed=true → RootNavigator (Inicio, Ventas, Productos, Historial, Más)
```

---

## 3. Persistencia local (esquemas verificados en el código)

### 3.1 SQLite — `micaja.db` (`src/repositories/database.native.ts`)

`PRAGMA journal_mode = WAL`. Tablas creadas con `CREATE TABLE IF NOT EXISTS` y migraciones ad-hoc
(`ensureColumn` con allowlist de identificadores, `sqlIdentifier.ts`):

**`products`**

| Columna          | Tipo/SQL          | Notas                                     |
| ---------------- | ----------------- | ----------------------------------------- |
| id               | TEXT PK NOT NULL  | id del producto                           |
| name             | TEXT NOT NULL     | sin índice                                |
| priceCents       | INTEGER NOT NULL  | precio en centavos                        |
| category         | TEXT NOT NULL     |                                           |
| imageType        | TEXT NOT NULL DEFAULT 'emoji' | emoji / icon / photo          |
| emoji            | TEXT (NULL)       |                                           |
| icon             | TEXT (NULL)       |                                           |
| imageUri         | TEXT (NULL)       | foto en caché                             |
| trackStock       | INTEGER NOT NULL DEFAULT 1 | columna legado; el modelo TS ya no la expone (siempre 1) |
| stockQuantity    | INTEGER NOT NULL DEFAULT 0 |                                       |
| active           | INTEGER NOT NULL DEFAULT 1 | booleano como 0/1                  |
| provider         | TEXT (NULL)       | nombre de proveedor (denormalizado)       |
| providerPhone    | TEXT (NULL)       | teléfono de proveedor (denormalizado)     |
| createdAt        | TEXT NOT NULL     | ISO string                                |

**`orders`**

| Columna        | Tipo/SQL               | Notas                                   |
| -------------- | ---------------------- | --------------------------------------- |
| id             | TEXT PK NOT NULL       |                                         |
| number         | INTEGER NOT NULL UNIQUE| correlativo local por dispositivo       |
| items          | TEXT NOT NULL          | JSON: `CartItem[]` (snapshot completo del producto) |
| subtotalCents  | INTEGER NOT NULL       | suma congelada                          |
| customerName / phone / address / description | TEXT NOT NULL DEFAULT '' | datos del cliente en el momento |
| status         | TEXT NOT NULL          | pending / paid / voided                 |
| paymentMethod  | TEXT (NULL)            | cash / transfer                         |
| receivedCents  | INTEGER (NULL)         | efectivo recibido                       |
| changeCents    | INTEGER (NULL)         | cambio devuelto                         |
| createdAt      | TEXT NOT NULL          |                                         |
| paidAt         | TEXT (NULL)            | ISO, si pagada                          |
| voidedAt       | TEXT (NULL)            | ISO, si anulada (migrado por ensureColumn) |
| voidReason     | TEXT (NULL)            | motivo de anulación                     |

Índices: `idx_orders_status`, `idx_orders_createdAt`, `idx_orders_number_unique`.

**`order_meta`** — tabla clave/valor (contiene `nextNumber` = correlativo de órdenes del dispositivo).

**`customers`** — id TEXT PK, name TEXT NOT NULL, phone/address/note TEXT DEFAULT '', createdAt TEXT NOT NULL.
Índice `idx_customers_name`.

**`providers`** — idéntica forma que `customers`. Índice `idx_providers_name`.

> **Observación:** los ítems de una orden guardan el objeto `Product` completo como snapshot
> (`CartItem = { product: Product, quantity }`). Es decir, la venta congeló nombre, precio e imagen al momento de
> agregarse al carrito, no al cobrar (ver §7).

### 3.2 AsyncStorage

| Llave                    | Contenido                                  |
| ------------------------ | ------------------------------------------ |
| `@micaja/business`       | `Business` (nombre, datos, logo, mensaje factura) |
| `@micaja/cashRegister`   | `CashRegister` activa (id, openingAmountCents, openedAt) |
| `@micaja/cashClosures`   | `CashClosureRecord[]` (histórico de cierres) |
| `@micaja/printer`        | `PrinterConfig` (dispositivo)              |
| `@micaja/driveToken`     | token OAuth Google (dormido)               |
| `@micaja/pendingSync`    | cola `string[]` de razones de sync (Drive, dormido) |

### 3.3 SecureStore (Keychain/Keystore en nativo)

- Llave `vendelo.user` → `User` en JSON: `{ id, username, passwordHash, passwordSalt, securityQuestion,
  securityAnswerHash, securityAnswerSalt, createdAt }`.
- En **web** degrada a AsyncStorage (`@micaja/user`) — documentado en el código — y **migra** el legado a
  SecureStore en el primer acceso (`secureStore.ts`).

---

## 4. Entidades persistentes (inventario)

| Entidad | Tabla/Almacén | PK | Relaciones | createdAt | updatedAt | Estado | Eliminable | Campos calculados/derivados |
| ------- | ------------- | -- | ---------- | --------- | --------- | ------ | ---------- | ---------------------------- |
| Business | AsyncStorage `@micaja/business` | ninguno (único) | 1 usuario, 1 dispositivo | `createdAt` | **no** | activo | sí (borrar cuenta) | logo, mensaje factura |
| User | SecureStore `vendelo.user` | `id` (UUID) | 1 negocio, 1 dispositivo | `createdAt` | **no** | activo | sí (borrar cuenta) | hash/sal PBKDF2, pregunta de seguridad |
| Product | SQLite `products` | `id` (TEXT) | ítem de Order (snapshot), provider (denormalizado) | `createdAt` | **no** | `active` 0/1 | sí (DELETE duro) | precio→centavos; stock→cantidad |
| Customer | SQLite `customers` | `id` (TEXT) | datos de Order.customer (copia) | `createdAt` | **no** | — | sí (DELETE duro) | — |
| Provider | SQLite `providers` | `id` (TEXT) | products.provider (copia denormalizada) | `createdAt` | **no** | — | sí (DELETE duro) | — |
| Order | SQLite `orders` | `id` (TEXT) | items (snapshot de Product), customer (copia), stock (reserva) | `createdAt` + `paidAt`/`voidedAt` | **no** | pending/paid/voided | pendientes sí (DELETE); paid/voided NO | `number` (correlativo), `subtotalCents` (congelado), cambio |
| CashRegister (caja abierta) | AsyncStorage `@micaja/cashRegister` | `id` (UUID) | órdenes por `paidAt ≥ openedAt` (lógico) | `openedAt` | **no** | abierta | se borra al cerrar | — |
| CashClosureRecord | AsyncStorage `@micaja/cashClosures` | `id` (UUID) | snapshot del turno (sin FK) | `closedAt` | **no** | inmutable | no (histórico) | esperado, diferencia, ventas por método |
| PrinterConfig | AsyncStorage `@micaja/printer` | ninguno | dispositivo | `connectedAt` | **no** | enabled/state | — | es dispositivo-local |
| order_meta.nextNumber | SQLite `order_meta` | key | correlativo por dispositivo | — | **no** | — | — | derivado de max(number)+1 al restaurar |
| DriveToken | AsyncStorage | ninguno | Google OAuth | `updatedAt` | sí | conectado/no | sí | dormido |

### Observaciones clave

- **No existe `updatedAt` en ninguna entidad de negocio.** (solo el driveToken y el reporte de Drive usan `updatedAt`)
- **No existe `deletedAt` ni tombstone.** Las bajas son `DELETE` duro (products, customers, providers, orders pending).
- **Sin versionado ni número de revisión** por fila.
- **Los datos del cliente en la orden son una copia** (no FK); borrar un cliente no afecta a sus órdenes históricas.
- **El proveedor del producto es denormalizado** (nombre/teléfono), sin FK al directorio de proveedores.

---

## 5. IDs (análisis crítico para sync)

### Cómo se generan hoy

- `generateId()` (`src/utils/password.ts`): `Crypto.randomUUID()` (UUID v4 con `expo-crypto`) en nativo,
  con **fallback** `id-<timestamp>-<random>` si no hay UUID disponible (web).
- **Productos semilla** (`seedProducts.ts`): ids fijos legibles (`hamburguesa`, `hotdog`, ...) con
  `createdAt` fijo `2026-01-01`. Solo afectan a una BD nueva/vacía.
- **Orden `number`**: correlativo **por dispositivo**, tomado de `order_meta.nextNumber` en SQLite
  (o `nextNumber` local en memoria). `UNIQUE` garantiza no duplicados **dentro** del dispositivo.
- **Código de factura `FAC-NNNN`** (`src/utils/invoice.ts`): derivado del `number` local.

### Riesgo para multi-dispositivo

| ID | ¿Sirve para sync multi-dispositivo? | Riesgo |
| -- | ----------------------------------- | ------ |
| `id` de Product/Customer/Provider/Order/User/Caja/Cierre (UUID v4) | ✅ Sirve | Colisión prácticamente imposible en generación; el fallback basado en `Date.now()+random` es débil pero muy improbable y solo en web |
| `number` de Order | ⚠️ **Riesgo alto** | Es **por dispositivo**: el Dispositivo A y el B generan ambas `number=1` offline → al sincronizar colisionan en PostgreSQL y el `FAC-NNNN` se duplicaría |
| `id` de productos semilla | ⚠️ Bajo | fijos por catálogo; si dos negocios nuevos los crean generan el mismo id, pero son seed idénticos por lo que serviría solo si se marcan como "seed" |
| `nextNumber` | ⚠️ Alto | estado local; dos dispositivos reservan el mismo correlativo |

### Recomendación (sin implementar)

1. **NO cambiar ahora** los `id` UUID: son el identificador natural para sync (upsert idempotente por `id`).
2. **El `number` y `FAC` deben dejar de ser globales** en el futuro: se propone que el **servidor asigne**
   números de factura **por negocio** (secuencia global) o que cada dispositivo reserve rangos, manteniendo
   el `number` local solo como referencia visual. Esto **sí requerirá migración** cuando se active multi-dispositivo.
3. Los **productos semilla** deben poder distinguirse (p. ej. `isSeed=true` o eliminar la siembra en cuentas que
   sincronizan) para evitar que dos negocios suban ids fijos idénticos. Riesgo bajo hoy.
4. Añadir un **sufijo/prefix de dispositivo** SOLO en metadata de sync (deviceId va en el paquete, no en los ids).

---

## 6. Fechas, versionado y detección de cambios

### Qué existe hoy

| Momento | Mecanismo |
| ------- | --------- |
| Creación  | `createdAt` (ISO, `new Date().toISOString()`) — productos, clientes, proveedores, órdenes, usuario, negocio |
| Apertura de caja | `openedAt` (ISO) |
| Cierre de caja | `closedAt` (ISO) en `CashClosureRecord` |
| Pago | `paidAt` (ISO) al cobrar |
| Anulación | `voidedAt` + `voidReason` |
| Modificación de producto/cliente/proveedor/negocio | **Ninguna** (se sobrescribe en el repo sin timestamp) |
| Eliminación | **Ninguna** (DELETE duro) |
| Sincronización | **Ninguna** (no hay cola operacional; solo la cola `pendingSync` de Drive dormido) |

### Implicación directa para sync

Hoy **no se puede detectar** de forma fiable: dato nuevo, dato modificado, dato eliminado o dato ya
sincronizado para productos/clientes/proveedores/negocio. Solo las órdenes tienen marcadores de cambio
de estado (`paidAt`/`voidedAt`), que además son los únicos "ingresos" registrados.

Para el Sync Engine futuro se necesitará (cambio mínimo en SQLite, ver §26):
- **`updatedAt`** por fila en las entidades mutables → para saber qué cambió desde la última sync.
- **`deletedAt` (tombstone)** o una **tabla de cambios/outbox** con `id`, `entity`, `entityId`, `op
  (create/update/delete)`, `ts`, `pending` → para propagar bajas sin romper historial.
- **Un correlativo de sync por negocio** o `updatedAt > since` como cursor.

---

## 7. Órdenes y ventas (comportamiento verificado)

### Flujo de estados

```
                 guardar        cobrar
   PENDING ────────────► PAID ──────────────► voided (anulación)
      │                     │
      └──► (cancelar)       └──► (anular) ──► VOIDED
            DELETE duro                            │
                                                  │
                    VOIDED ─── inmutable ──────────┘
```

- `assertOrderTransition` (`src/utils/orderState.ts`) prohíbe: modificar paid/voided, volver a pending,
  modificar una anulada. Validado también en el repo SQLite y en memoria (doble capa).
- **Orden pendiente:** reserva stock al guardar (`reserveOrderStock`). Se puede modificar el carrito,
  cobrar, cancelar (DELETE + liberar stock). No descuenta dos veces.
- **Orden pagada:** stock ya reservado; inmutable excepto pasar a **voided** (anulación) con razón.
- **Orden anulada (paid→voided):** se devuelve stock (`adjustStock`), queda `voidedAt`/`voidReason`,
  sigue en el historial (`listAll`).

### Congelamiento de precios (confirmado)

- El ítem del carrito lleva **el objeto `Product` completo** cuando se agrega al carrito.
- `buildOrder` calcula `subtotalCents` con `item.product.priceCents * quantity` en ese momento.
- Cobrar una pendiente **no recalcula** contra el catálogo (solo stock y estado).

→ **Inmutable post-pago/anulación:** subtotal, líneas (producto snapshot, cantidad, precio), cliente,
número recibido/cambio, método de pago, horas de pago/anulación. La sincronización **no debe** poder
modificar nada de ello.

### Secuencia global y factura

- `number` se asigna por dispositivo; `FAC-NNNN` deriva de `number` (§5). El código de factura solo es
  único por dispositivo (colisión en multi-dispositivo).

---

## 8. Inventario

### Cómo se modifica el stock

- `productRepository.decreaseStock(id, q)` / `adjustStock(id, delta)` — **UPDATE directo** de
  `products.stockQuantity` con `MAX(0, ...)`.
- Se descuenta en: guardar pendiente, cobrar nueva, cobrar pendiente (reserva).
- Se devuelve en: cancelar/editar pendiente, anular venta.
- Edición manual del producto puede ajustar el stock directamente (QuickEdit, ProductForm).

### Lo que NO existe

- **No hay registro de movimientos de inventario** (no existe tabla `stock_movements`).
- **El stock no es reconstruible** a partir de movimientos (solo hay el saldo final).
- Transacciones SQLite: sí existen y son atómicas (guardar/cobrar/anular/cancelar con `withTransaction`),
  pero las ediciones manuales de stock no.

### Implicación para sync

- El stock es **estado**, no historial. Debe sincronizarse como `stockQuantity` con regla de conflicto
  (ver §14-B). Si en el futuro se quiere auditoría/inventario, se añadiría un ledger de movimientos, pero
  eso es un cambio mayor que **no** se hace en esta fase.

---

## 9. Caja

### Apertura

- `CashRegister { id, openingAmountCents, openedAt }` en AsyncStorage. Solo una caja abierta a la vez.
- Sin caja abierta la app bloquea las ventas (solo inventario).

### Cierre (snapshot inmutable)

- `closeRegister` exige caja abierta, guarda `CashClosureRecord`:
  `id, closedAt, openingAmountCents, expectedCashCents, countedCashCents, differenceCents, orderCount,
  salesCents, cashSalesCents, transferSalesCents` y elimina la caja abierta.
  Después, crea **respaldo automático local** (`autoBackupService`).
- `isOrderInRegister`/`computeCashTotals`: solo órdenes `paid` con `paidAt ≥ openedAt` (comparación de
  ISO strings). Transferencias no cuentan para el efectivo esperado.

### Regla documentada (Fase 3 de la auditoría técnica)

- El cierre es una **foto inmutable del turno**. Una anulación posterior al cierre NO reescribe el registro:
  su efecto se manifiesta en el turno siguiente.
- **La sincronización NO debe modificar silenciosamente un cierre ya realizado**: un cierre es sistémico
  histórico; los cierres sincronizados deben usarse como solo-lectura (o anulación explícita con nuevo registro).

### Implicación para sync

- `cashClosures` → **C (reglas especiales): sincronizar como immutables**, solo lectura tras subir.
- Caja abierta → **local por dispositivo** (cada dispositivo/físico puede abrir su caja; el estado abierto
  no se sincroniza, o se sincroniza como metadata de dispositivo, no de negocio).

---

## 10. Autenticación actual

### Registro (setup)

- `saveSetup`: genera `salt` (16 bytes hex), `passwordHash = PBKDF2-HMAC-SHA256(password, salt, 100 000, 32)`
  en formato `pbkdf2$100000$hex`; guarda negocio en AsyncStorage y usuario en SecureStore.
- Pregunta de seguridad opcional: respuesta normalizada (`trim().toLocaleLowerCase()`) y hasheada igual (PBKDF2).

### Login

- `verifyLogin` → compara PBKDF2 en **tiempo constante**; detecta hash legado (SHA-256 de una pasada) y
  re-hashea al vuelo (upgrade-on-login). Devuelve solo `SessionUser { id, username, createdAt }` (sin hash).
- No distingue mayúsculas en username; nunca revela cuál campo falló.
- **Sesión = booleano** (`AuthContext.authed`). Sin tokens, sin persistencia de sesión, sin expiración.
  Cada arranque requiere login de nuevo.

### Recuperación de contraseña (hoy)

- Local, por **pregunta de seguridad** (misma cuenta en el mismo dispositivo). No hay email/telefono.
- Cuenta restaurada sin credenciales → crea contraseña nueva en el flujo "Restaurar" (`firstPassword`).

### Información almacenada localmente (resumen)

| Lugar | Qué hay |
| ----- | ------- |
| SecureStore | hash+salt (password), pregunta/respuesta (hash+salt), username, id, createdAt |
| AsyncStorage | business (sin secretos), caja, cierres, printer, drive token, cola |
| SQLite | datos operativos (productos, órdenes, clientes, proveedores). Sin secretos |

### Implicación para backend

- El backend debe tener **su propio** hash de contraseña (p. ej. Argon2/bcrypt) con sal por usuario. El hash
  PBKDF2 del cliente es para autenticación local y **no debe subirse al servidor** (los respaldos ya lo
  excluyen, Fase 5).
- Hoy **no hay identificación por email/telefono** → requisito nuevo para recuperación de cuenta remota (§17).
- Dispositivo: hoy no existe `deviceId` persistido.

---

## 11. Backups actuales

### Qué hace hoy

- **Exportar respaldo** (`exportBackupToShare`): construye `BackupBundle` y comparte un `.json`:

```
BackupBundle = {
  app: 'vendelo', version: 1, exportedAt,
  business,            // Business | null (credenciales NO)
  user,                // SanitizedUser { id, username, createdAt }  ← sin hash/sal/pregunta
  cashRegister,        // caja abierta (o null)
  cashClosures,        // historial de cierres
  printer,             // config de impresora (dispositivo)
  products, orders, customers, providers,
}
```

- **Validación profunda** (`validateBackupData`): campo por campo (productos, órdenes, clientes,
  proveedores, cierres, caja); rechaza archivos corruptos con mensaje exacto; retrocompatible con
  versiones viejas (campos opcionales).
- **Restaurar** (`restoreBackupFromFile` → `applyRestoredBundle`):
  1. valida → 2. **cuarentena** previa (`vendelo-pre-restore-<ts>.json` en caché) → 3. limpia
  AsyncStorage + borra BD SQLite + resetea repositorios → 4. reescribe todo (usuario sanitizado a
  SecureStore, restaurando la posibilidad de crear contraseña nueva) → 5. `restoreOrders` respeta
  `number` y `order_meta.nextNumber = max(number)+1`.
- **Respaldo automático** (`createLocalAutoBackup`): tras **cada cierre de caja**, snapshot completo en
  `documentDirectory/vendelo/respaldo-auto-*.json`, retención de **los últimos 5**.
- **Borrar cuenta**: limpia storage + BD + SecureStore.
- **Drive (dormido)**: `driveService` con OAuth PKCE y `syncQueue` que sube el bundle completo.
  `GOOGLE_CLIENT_ID = ''` y fuera de la UI. Reutilizable como referencia de "upload de bundle".

### Qué reutilizar para backup remoto

- El **serializador/validador** (`serializeBackup`/`parseBackup`/`validateBackupData`) es portable tal cual.
- El **saneado del usuario** (sin credenciales) ya está listo.
- La **cuarentena previa a restaurar** es un buen patrón a mantener.
- **Falta**: checksum (SHA-256 del bundle) y cifrado del bundle si se sube a la nube (clave derivada del
  password del usuario: documentado en `docs/BACKEND.md`, no implementado).
- **No se reemplaza** el backup local: el remoto es complementario.

---

## 12. SYNC ≠ BACKUP (diferencia en el estado actual)

| | Hoy (real) |
| -- | ---------- |
| **Sync** | **NO existe como tal.** La única vía de salida de datos es subir el *respaldo completo* a Drive (dormido). No hay sync diferencial, ni cola operacional por registro, ni reconciliación. |
| **Backup** | Sí: snapshot completo local por archivo + automático post-cierre (carpeta `vendelo/`), con validación, cuarentena y retención. |

**Conclusión:** no hay que mezclar. El futuro requiere **dos canales separados**:

1. **Sync operacional** (`POST /sync` + `GET /sync?since=`): registros delta por entidad, con
   `updatedAt`/tombstone, deviceId y reglas de conflicto (§14).
2. **Backup remoto** (`PUT /backups`): el mismo bundle validado (o versión cifrada) como snapshot de
   recuperación, con metadatos en PostgreSQL y almacenamiento de objetos (§19).

---

## 13. Clasificación de datos para sync (A / B / C)

| Entidad | Clase | Motivo |
| ------- | ----- | ------ |
| Product | **A** — sincronizar | Catálogo operativo; necesita `updatedAt` + tombstone |
| Customer | **A** — sincronizar | Directorio operativo; `updatedAt` + tombstone |
| Provider | **A** — sincronizar | Directorio operativo; `updatedAt` + tombstone |
| Order | **C** — sincronizar con reglas | Operation critical: `paid`/`voided` inmutables, `number` local, stock reservado, precio congelado |
| CashClosureRecord | **C** — sincronizar inmutable | Snapshot del turno; solo-lectura tras subir (no modificar jamás) |
| Business | **A** — sincronizar | Datos del negocio (nombre, teléfono, dirección, logo, mensaje). Ya no incluye credenciales |
| User (credenciales) | **B** — local | Hash/sal/pregunta de seguridad NUNCA salen del dispositivo. Solo `id/username/createdAt` van en backup como metadata |
| CashRegister (caja abierta) | **B** — local por dispositivo | Estado transitorio de turno; cada punto de venta abre su caja |
| PrinterConfig | **B** — local por dispositivo | Hardware específico del dispositivo |
| DriveToken / pendingSync | **B** — local | Credenciales/infraestructura de dispositivo |
| order_meta.nextNumber | **B** → C | Correlativo local; si se adopta número global de factura, el servidor pasa a C |

---

## 14. Conflictos (escenarios y reglas propuestas)

### Escenario A — Producto editado en A y B offline a la vez
**Qué pasa hoy:** ninguno detecta al otro (no hay `updatedAt`).
**Regla propuesta:** **Last-Writer-Wins (LWW)** por `updatedAt` (o por version/`revision` en el futuro).
El servidor guarda ambas versiones si llegan en orden inverso (la más antigua NO pisa la más nueva).
Alternativa documentada en `docs/BACKEND.md`: «`createdAt` más reciente gana» → sustituir por `updatedAt`.

### Escenario B — Venta creada offline en A; B modifica el producto; la venta sincroniza después
**Regla propuesta:** la venta conserva sus **valores congelados** (snapshot del ítem: nombre, precio,
cantidad, subtotal) **sin recalcular** contra el catálogo (regla Fase 12). El stock se valida contra la
cantidad actual en el momento del sync: si no alcanza, la venta **queda marcada** (pendiente de stock /
flag) y se notifica; nunca se reescribe la venta.

### Escenario C — Se intenta modificar una venta ya pagada
**Regla propuesta:** **rechazar** (aplica `assertOrderTransition` tanto en el cliente como en el servidor).
El servidor devuelve `409 Conflict` y la venta queda intacta.

### Escenario D — Se intenta modificar un cierre ya realizado
**Regla propuesta:** **rechazar/inmutable**. Un cierre sincronizado es read-only. Cualquier ajuste del
dinero se expresa en un cierre NUEVO (turno siguiente). El servidor no aplica updates a cierres.

### Escenario E — Se elimina un producto mientras otro dispositivo está offline
**Regla propuesta:** con **tombstone**: A borra → sube `deletedAt` → B recibe el tombstone en su próxima
sync y lo retira/archiva (los ids en órdenes históricas se conservan gracias al snapshot; no se rompe nada).
Sin tombstone (estado actual), un delete nunca se propaga → los catálogos divergen (riesgo documentado).

### Escenario F — La misma orden llega dos veces al servidor (timeout + reintento)
**Regla propuesta:** **idempotencia por id natural** (upsert por `id` UUID) + **`IdempotencyKey`/`requestId`
por batch** en el servidor: si el batch ya fue procesado, se responde **200 con el resultado original**
(sin duplicar). Ver §15.

---

## 15. Idempotencia (propuesta, sin implementar)

### Estrategia recomendada: clave de idempotencia por operación + upsert por id

```
App:  genera UUID por operación (requestId) y batchId por lote
Server: tabla sync_batches (requestId UNIQUE, device_id, created_at, response_json)
  1. Si requestId ya existe → devolver la MISMA respuesta original (replay, no reejecutar).
  2. Si no existe → procesar el lote:
       - INSERT ... ON CONFLICT (id) DO UPDATE  (upsert por id natural UUID)
       - órdenes: solo se aceptan transiciones válidas (assert de estado en el servidor)
       - cierres: solo-lectura (ignorar/rechazar updates)
  3. Registrar requestId + respuesta en el mismo commit (transacción) para que la deduplicación sea atómica.
```

### Garantías que debe cumplir

- **Nunca dos ventas** por timeout (el upsert por `id` del Order lo evita; la clave de batch evita reprocesos).
- **Respuesta repetible**: mismo `requestId` → misma respuesta; el cliente lo usa para confirmar.
- El ids de entidad (UUID cliente) es la **columna natural** de deduplicación: una orden creada offline
  conserva su `id` y nunca se crea una segunda.
- La secuencia global de factura (§5) se asigna **en el servidor, una sola vez por creación**, con su
  propio mecanismo idempotente (si la orden ya tiene `invoiceNumber`, no se reasigna).

---

## 16. Arquitectura futura (adaptada a lo que existe)

**Monolito modular ASP.NET Core Web API + C# + PostgreSQL.** Nada de microservicios ni Clean Architecture
sobredividida: proyectos internos por dominio (sencillos de aprender).

```
Vendelo Mobile (React Native + TS)
│  Pantallas → Servicios → Repositorios
│  SQLite  +  AsyncStorage  +  SecureStore
│  Sync Engine        → POST/GET /sync (delta, outbox, conflictos)
│  Backup Manager     → PUT/GET /backups (bundle cifrado, SHA-256, metadata)
│  Auth Session       → login/registro/refresh/logout + deviceId
          │  HTTPS / JSON (fetch nativo)
          ▼
ASP.NET Core Web API (monolito modular)
│  ├── Auth          (registro, login, refresh, logout, recuperación)
│  ├── Users / Businesses / Devices
│  ├── Products / Customers / Suppliers   (catálogos A)
│  ├── Orders / Inventory                 (ventas C + stock)
│  ├── Registers                         (cierres inmutables C)
│  ├── Sync                              (lotes idempotentes, cursor `since`)
│  └── Backups                           (IBackupStorage + metadata)
          │
          ▼
PostgreSQL (datos relacionales + metadata de backups + idempotencia)
   Almacenamiento de objetos (backups grandes: S3/Azure Blob/local FS)
```

Mapeo con el código real (nada sobra, nada se inventa):

| Módulo app actual | Módulo backend |
| ----------------- | -------------- |
| `setupService` (business+user) | Users, Businesses |
| `setupService` + SecureStore (credenciales) | Auth (el servidor guarda su propio hash) |
| `productRepository`, `customerRepository`, `providerRepository` | Products, Customers, Suppliers |
| `orderService` + `orderRepository` + `stockService` | Orders, Inventory |
| `cashRegisterService` (cierres) | Registers (solo-lectura tras subir) |
| `backup.ts` + `backupService` + `autoBackupService` | Backups (reutiliza bundle/validador) |
| `syncQueue` + `driveService` (dormido) | Sync (sustituye la subida tipo "backup" por sync real) |
| `AuthContext` (booleano) | Auth Session (token + refresh + deviceId) |

---

## 17. Recuperación de cuenta (diseño propuesto)

Flujo objetivo (teléfono perdido → teléfono nuevo):

```
Instalar Vendelo → email/teléfono → código temporal → verificación
→ nueva contraseña → nueva sesión → recuperar negocio → sync/restore
```

### Requisitos de diseño

1. **Identidad de recuperación nueva:** hoy la cuenta es solo `username` en el dispositivo (sin email/
   telefono). Hay que añadir (en Fase 1 del backend, cuando se autorice) **email o teléfono del dueño**.
2. **Código temporal:** de 6 dígitos, **hash en el servidor** (no texto plano), **expiración** (5–10 min),
   **máx. intentos** (p. ej. 5, luego invalida), **un solo uso**.
3. **Rate limiting:** límite de envío por dirección/hora (p. ej. 3/h) y por IP.
4. **Anti-enumeración:** mensajes **genéricos e idénticos** ya exista o no la cuenta
   («Si la cuenta existe, recibirás un código») — **diferente del login local actual**, que sí revela
   «Ese usuario no existe» (aceptable localmente, NO en el servidor).
5. **Abstracciones:** `ISmsSender` y `IEmailSender` (§18).
6. **Restaurar el negocio:** tras nueva contraseña, la app registra su `deviceId`, solicita la lista de
   backups del negocio y restaura (reutilizando `applyRestoredBundle` tras descifrar con la clave derivada
   del password), o hace sync inicial desde el servidor.

---

## 18. Dispositivos y proveedores de canal (abstracciones)

### Modelo de dispositivos

```
User (dueño)
   └── Business (uno por cuenta en el MVP; extensible a varios)
          ├── Device A   (nombre/plataforma, lastSeenAt, estado)
          ├── Device B
          └── Device C
```

- Registrar dispositivo en el primer login online (`deviceId` UUID persistido localmente + metadata).
- Identificar en cada petición de sync (header `X-Device-Id`).
- **Revocar dispositivos** (cambiar contraseña invalida sesiones/refresh tokens de todos los dispositivos
  excepto el actual, o lista blanca).
- **Cerrar sesiones remotas** y marcar `revokedAt`.
- Dispositivo offline → la app sigue funcionando (offline-first), sin cambios en su operación.

### Abstracciones de envío (sin implementar)

```csharp
public interface IEmailSender  { Task SendAsync(string to, string subject, string body); }
public interface ISmsSender    { Task SendAsync(string phone, string body); }
public interface IBackupStorage { Task<UploadResult> UploadAsync(string objectKey, Stream data, long size,
                                  string sha256Hex, CancellationToken ct);
                                  Task<Stream?> DownloadAsync(string objectKey, CancellationToken ct);
                                  Task DeleteAsync(string objectKey, CancellationToken ct); }
```

- Implementaciones concretas SOLO en configuración del servidor (appsettings/secrets).
- Claves de proveedores: **jamás** en React Native, **jamás** en Git, **jamás** hardcodeadas → Secret
  Manager / variables de entorno del servidor.

---

## 19. Backup remoto (diseño conceptual)

```
App  Crea bundle → valida (serializador actual) → cifra → SHA-256 → HTTPS
  → POST /backups  (multipart: metadata JSON + payload cifrado)
  → Servidor: verifica auth + permisos del negocio, valida metadata, calcula su propio SHA-256 y lo
    compara con el del bundle, almacena vía IBackupStorage, guarda metadata en PostgreSQL (transacción)
  → Responde SOLO "Backup confirmado" (200) cuando recibido + validado + almacenado + verificado.
```

- El SHA-256 del payload se **recalcula en el servidor**: la confirmación solo se emite si coincide.
- **PostgreSQL guarda metadata**: `backups(id, business_id, sha256, size_bytes, object_key, version,
  exported_at, created_at, status)`. Los bytes grandes van al almacenamiento de objetos (`IBackupStorage`).
- **Cifrado del bundle** con clave derivada del password del usuario (PBKDF2, mismo estándar ya presente
  en `password.ts`) para que el servidor **no pueda leer** el contenido (privacidad). El servidor solo
  guarda metadata + blob. Clave derivada se recrea al iniciar sesión; NO se almacena.
- El **backup local por archivo y automático (post-cierre) se conserva intacto**; el remoto es un canal
  adicional.

---

## 20. API inicial (contratos y responsabilidades, no implementada)

### Auth

| Método/Path | Responsabilidad |
| --- | --- |
| `POST /api/auth/register` | Crea user + business (valida si email ya existe sin revelar; devuelve token) |
| `POST /api/auth/login` | Verifica credenciales, emite access + refresh + deviceId |
| `POST /api/auth/forgot-password` | Acepta email/teléfono; SIEMPRE respuesta genérica; genera y envía código |
| `POST /api/auth/verify-recovery-code` | Valida código (hash, 1 uso, expiración, intentos); devuelve ticket de reseteo |
| `POST /api/auth/reset-password` | Establece nueva contraseña (servidor hashea); invalida otros devices |
| `POST /api/auth/refresh` | Renueva access con refresh token válido |
| `POST /api/auth/logout` | Revoca refresh/session del dispositivo |
| `POST /api/auth/revoke-device` | Revoca un dispositivo concreto |

### Recursos (protegidos por JWT + autorización por negocio)

| Grupo | Endpoints iniciales |
| --- | --- |
| Businesses | `GET /api/businesses/{id}`, `PUT /api/businesses/{id}`, `GET /api/businesses/{id}/devices` |
| Devices | `GET/POST/DELETE /api/devices`, `POST /api/devices/{id}/revoke` |
| Sync | `POST /api/sync` (lote delta con requestId/batchId, upsert idempotente), `GET /api/sync?since=&deviceId=` (descarga de cambios, cursor), `GET /api/sync/status` |
| Backups | `PUT /api/backups/{businessId}` (sube bundle + SHA-256), `GET /api/backups/{businessId}` (lista metadata), `GET /api/backups/{businessId}/{backupId}` (descarga), `DELETE /api/backups/{businessId}/{backupId}` |

> Todo endpoint que reciba un `id` de negocio valida que la petición **pertenece al negocio autenticado**
> (jamás autorizar por id cambiado en la URL, §22).

---

## 21. PostgreSQL (propuesta de esquema — NO crear todavía)

Naming `lower_snake_case`, PK UUID (`gen_random_uuid()` o el uuid del cliente), `created_at`/`updated_at`
como `timestamptz`, soft-delete con `deleted_at`.

| Tabla | Columnas clave | Relaciones / Notas |
| --- | --- | --- |
| `users` | id PK, email (UNIQUE, null ok), phone (UNIQUE, null ok), password_hash, created_at, updated_at | hash del servidor (Argon2/bcrypt); email/phone para recuperación |
| `businesses` | id PK, user_id FK, name, phone, address, logo_object_key, invoice_message, created_at, updated_at | 1 usuario → 1..n negocios |
| `devices` | id PK, business_id FK, name, platform, created_at, last_seen_at, revoked_at | sesiones/refresh por dispositivo |
| `sessions` | id PK, user_id FK, device_id FK, refresh_token_hash, expires_at, created_at, revoked_at | token guardado como **hash**, no plano |
| `recovery_codes` | id PK, user_id FK, channel (email/phone), code_hash, expires_at, max_attempts, attempts_used, used_at, created_at | código hasheado, 1 uso |
| `sync_batches` | id PK, request_id (UNIQUE), device_id FK, business_id FK, status, response_json, created_at | **idempotencia** de batches |
| `products` | id PK (uuid del cliente), business_id FK, name, price_cents, category, image_type, image_uri, provider, provider_phone, stock_quantity, active, created_at, updated_at, deleted_at | id del cliente = natural (upsert por id) |
| `customers` / `providers` | id PK, business_id FK, name, phone, address, note, created_at, updated_at, deleted_at | id cliente |
| `orders` | id PK, business_id FK, **invoice_number** (UNIQUE por negocio), status, payment_method, received_cents, change_cents, subtotal_cents, customer_jdoc JSONB, created_at, paid_at, voided_at, void_reason, updated_at | `number` local NO es único global; `invoice_number` lo asigna el servidor |
| `order_items` | id PK, order_id FK, product_id (nullable FK), name_snapshot, unit_price_cents, quantity | snapshot (no reescribir); opcional mantener `orders.items` JSONB para fidelidad al snapshot |
| `cash_closures` | id PK, business_id FK, opened_at, closed_at, opening_amount_cents, expected_cash_cents, counted_cash_cents, difference_cents, order_count, sales_cents, cash_sales_cents, transfer_sales_cents, created_at | **inmutable** (no acepta update) |
| `backups` | id PK, business_id FK, sha256, size_bytes, object_key, backup_version, exported_at, created_at, status | metadata; bytes en object storage |
| `stock_events` (futuro) | id PK, product_id FK, delta, order_id nullable, reason, device_id FK, created_at | solo si se decide inventario auditable; NO ahora |

### Índices/constraints propuestos clave

- UNIQUE por negocio: `products(id)`, `orders(invoice_number)`, `sync_batches(request_id)`,
  `users(email)`, `users(phone)`.
- Índices de sync: `products(business_id, updated_at)`, `orders(business_id, updated_at)`,
  `devices(business_id, last_seen_at)`.
- FK de negocio en todas las tablas operativas → **aislamiento por negocio** (query nunca sin `business_id`).

---

## 22. Seguridad (actual y futura)

### Estado actual (bueno)

- PBKDF2-HMAC-SHA256, 100 000 iteraciones, sal de 16 bytes por usuario, comparación en tiempo constante.
- Hash/sal en **SecureStore** (Keychain/Keystore); nunca en respaldos (usuario saneado).
- Sesión local sin exponer secretos (`verifyLogin` devuelve `SessionUser`).
- IDs UUID, validación profunda de restauración, cuarentena previa.

### Riesgos actuales (para tener en cuenta)

- **Enumeración de cuenta en "¿Olvidaste tu contraseña?"** («Ese usuario no existe») — aceptable local,
  prohibido en el backend.
- **No hay límites de intentos** de login en la lógica local (no aplicable offline; el backend sí debe
  rate-limit).
- `driveToken` en AsyncStorage (dormido; si se reactiva, considerar SecureStore).
- Fallback `generateId()` en web (débil) — riesgo bajo.

### Requisitos de seguridad del backend (reglas mínimas)

1. Contraseñas del **servidor**: Argon2/bcrypt con sal propia. No reutilizar el PBKDF2 del dispositivo.
2. **JWT de corto plazo** + **refresh token** corto, guardado como **hash**, revocable por dispositivo.
3. **Autorización por negocio** en TODA query: validar `business_id` de la ruta contra el del token
   (proteger contra IDOR: cambiar un id en la URL no da acceso a otro negocio).
4. **Nunca** aceptar `passwordHash`/`salt` en ningún payload (reforzar con test §23).
5. **Rate limiting** en auth (login, forgot, verify) por IP/usuario/device.
6. **Mensajes genéricos** en recuperación (no revelar existencia), códigos hasheados, 1 uso, expiración,
   intentos limitados (§17).
7. **HTTPS obligatorio**, validación de entrada (contratos/validadores), paginación y límites de tamaño en
   sync/backups.
8. Secrets de proveedores solo en configuración de servidor (§18).

---

## 23. Riesgos detectados (resumen ejecutivo)

| # | Riesgo | Severidad | Detalle |
| - | ------ | --------- | ------- |
| 1 | `number` de orden y `FAC-NNNN` colisionan entre dispositivos | Alta | correlativo por dispositivo (§5) |
| 2 | Sin `updatedAt`/`deletedAt` → no se detectan cambios ni bajas | Alta | impide sync diferencial (§6) |
| 3 | Stock = estado sin ledger → conflictos de stock no reconstruibles | Media | regla LWW por estado + validación al sync (§14-B) |
| 4 | Cierres de caja fuera de SQLite en AsyncStorage | Media | hay que leer 2 capas; cierres inmutable (reutilizable) |
| 5 | Sin identidad email/telefono → sin recuperación remota de cuenta | Alta | requisito nuevo (§17) |
| 6 | No hay deviceId ni sesión persistente → no hay multi-dispositivo ni revocación | Media | modelo Devices (§18) |
| 7 | Backup sin cifrado ni checksum | Media | cifrar con clave del usuario + SHA-256 servidor (§19) |
| 8 | Login local revela existencia de usuario | Baja (local) / Alta (remoto) | no replicar en backend (§22-6) |
| 9 | Web usa AsyncStorage para credenciales (fallback) | Baja | documentado; el backend no depende de esto |
| 10 | Productos semilla con ids fijos | Baja | si se sincronizan dos negocios, colisionan ids semilla (§5) |

---

## 24. Recomendaciones (sin implementar en Fase 0)

1. **No tocar ahora** ids, números, auth ni SQLite: todo lo crítico es migrable con cambios mínimos
   cuando se autorice la Fase 1.
2. Próximo cambio en la app (antes de backend, cuando se decida): añadir **`updatedAt` + `deletedAt`**
   (o tabla de cambios/outbox) y un **`deviceId` persistido**. Sin esto no hay sync real.
3. Mover `cashClosures` a SQLite **cuando haya sync** (para entrarlas al outbox) y considerar mover
   `business` y `user` a tablas SQLite para unicidad de identidad + cursor `since`. Hoy pueden quedar
   donde están.
4. Definir la **secuencia global de factura por negocio** en PostgreSQL como substituto de `number`
   cuando se active multi-dispositivo.
5. Reutilizar `serializeBackup`/`validateBackupData`/saneado de usuario para el backup remoto.
6. **No reemplazar** el backup local ni el flujo offline; el backend es complementario.

---

## 25. Plan de implementación propuesto (fases siguientes, sujetas a tu autorización)

> **Regla absoluta:** no se pasa a FASE 1 hasta autorización explícita. Cada fase = un commit descriptivo,
> verificación (`tsc` + `jest`), y en el backend `dotnet build` + tests.

- **Fase 1 — App: base de sync en el cliente (sin servidor)**
  - `updatedAt` + `deletedAt`/outbox en SQLite (migraciones con `ensureColumn`).
  - `deviceId` persistido (SecureStore/AsyncStorage). Cursor local `lastSyncedAt`.
  - Tests. Sin cambios de IDs ni de autenticación.
- **Fase 2 — Contrato de API (diseño)**: documentar `docs/API-DESIGN.md` con los contratos de §20.
- **Fase 3 — Backend: scaffold ASP.NET Core Web API + PostgreSQL + autenticación**
  - Monolito modular, EF Core (Npgsql) o Dapper + migraciones SQL; Auth (register/login/refresh/revoke), Busineses, Devices. Contraseñas Argon2. Rate limiting. Anti-enumeración.
- **Fase 4 — Sync engine**: `POST /sync` (idempotente por `requestId`, upsert por id, `assertOrderTransition`
  en el servidor, cierres inmutable) + `GET /sync?since=`. Matriz de conflictos en tests.
- **Fase 5 — Recuperación de cuenta**: email/telefono en registro, código temporal (hash + expiración +
  intentos), `forgot/verify/reset`, `ISmsSender`/`IEmailSender`.
- **Fase 6 — Backup remoto**: `IBackupStorage` + `PUT/GET /backups`, SHA-256 servidor, cifrado del bundle
  con clave del usuario, metadata en PostgreSQL.
- **Fase 7 — Restauración en teléfono nuevo**: flujo completo (instalar → login → listar backups → restaurar →
  sync inicial).
- **Fase 8 — Multi-dispositivo real**: secuencia global de factura por negocio, conflictos de stock,
  inventario (ledger `stock_events` si se decide), revocación de dispositivos.

---

## 26. Cambios reales necesarios en SQLite (los mínimos)

> Lista de lo que HARÁ FALTA (cuando se autorice). Nada de esto se implementa en Fase 0.

1. `updated_at TEXT` en `products`, `customers`, `providers`, `orders` (migrable con `ensureColumn`).
2. `deleted_at TEXT` (tombstone) en catálogos, o tabla `sync_changes`/outbox:
   `(id, entity, entity_id, op, ts, synced_at)` para propagar altas/ediciones/bajas.
3. `device_id` + `last_synced_at` (o tabla `sync_state`).
4. Mover `business` y `cashClosures` a SQLite (opcional, recomendado al activar sync) con las mismas columnas que hoy (denormalizadas a tablas, sin historia nueva).
5. **NO** cambiar el tipo/estrategia de `id`. **NO** tocar `number`/`order_meta` hasta el paso al número global de factura.
6. **NO** cambiar hashing/autenticación local (el servidor tiene los suyos).

---

## Documentos futuros (NO creados en esta fase)

- `docs/BACKEND-ARCHITECTURE.md` — arquitectura del monolito modular (se crearán cuando se autorice).
- `docs/AUTH-DESIGN.md`, `docs/SYNC-DESIGN.md`, `docs/BACKUP-DESIGN.md`, `docs/API-DESIGN.md`.

---

## Validación de la fase (no alteró el funcionamiento)

Los siguientes comandos se ejecutaron DESPUÉS de crear este documento sobre la rama `main` en
`d32e79e`; resultados en la respuesta de sesión:

- `git status` / `git branch` / `git log -5 --oneline` → rama `main`, árbol limpio.
- `npm test`
- `npx tsc --noEmit`
- `npx expo-doctor`

Cualquier fallo preexistente se documenta en la respuesta de la sesión (no se esperan cambios en el working tree aparte de este archivo).