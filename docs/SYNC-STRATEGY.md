# Vendelo App — Estrategia de sincronización (FASE 0.5)

> **Objetivo:** decidir, argumentar y documentar la estrategia de sincronización entre SQLite (app) y
> PostgreSQL (server) para la futura arquitectura ASP.NET Core. Esta fase es **solo análisis + diseño**:
> no se toca código, SQLite, IDs, autenticación ni backlog. No se crea backend ni tablas.

- **Fecha:** 21/09/2026
- **Commit base:** `d32e79e` (rama `main`, sincronizada con `origin/main`).
- **Base documental:** `docs/BACKEND-AUDIT.md` (FASE 0). En este mismo repo, pendiente de commit.
- **Validación del estado (FASE 0):** 258 tests / 31 suites; `tsc --noEmit` limpio; `expo-doctor` 21/21.

---

## 1. Objetivo

Determinar la estrategia óptima de sincronización para Vendelo, entendiendo que:

- La app debe **seguir funcionando 100 % offline** (crear, cobrar, ajustar stock, cerrar caja).
- La sincronización nunca debe **bloquear ni ralentizar** la operación.
- Las **ventas pagadas/anuladas y los cierres de caja son inmutables** (regla existente de la app).
- Los **precios se congelan** en cada venta (snapshot en los ítems).
- Hay que soportar en el futuro **varios dispositivos por negocio** y **recuperación de cuenta/teléfono**.

Ejes del análisis: dos estrategias puras (A: `updatedAt+deletedAt`; B: Outbox), su mezcla, los casos
críticos reales de un POS, idempotencia, orden, offline-first, primer sync, escala.

---

## 2. Estado actual (verificado contra el código)

Recuerdo de lo verificado en FASE 0 y re-confirmado:

- **La app ya es atómica e idempotente localmente** (`orderService` + `withTransaction`; doble cobro/anulación/cancelación bloqueado; `assertOrderTransition` en repo y servicio).
- **No existe `updatedAt` ni `deletedAt`** en ninguna entidad de negocio (productos, clientes, proveedores, órdenes, negocio). Solo `createdAt`, y `paidAt`/`voidedAt`/`openedAt`/`closedAt` como hitos.
- **Las bajas son DELETE físico** (products, customers, providers, órdenes pendientes).
- **Números de orden (`number`) y `FAC-NNNN` son correlativos por dispositivo** (`order_meta.nextNumber` en SQLite) → colisión en multi-dispositivo; pendiente de resolver con número global.
- **Los ítems de la orden guardan el objeto `Product` completo (snapshot)** → el precio ya está congelado en origen.
- **Stock = estado directo** (`products.stockQuantity`), sin ledger de movimientos. No reconstruible.
- **Cierra** la caja: snapshot inmutable en AsyncStorage (`cashClosures`), con desglose; se genera respaldo automático.
- **Único "sync" actual:** `syncQueue` + `useDriveSync` (dormido, `GOOGLE_CLIENT_ID=''`), que sube el *respaldo completo* a Drive. No hay sync diferencial.

**Conclusión de partida:** hoy un «sync» no existe; hay backup. La estrategia debe construirse sobre lo
que la app YA garantiza (inmutabilidad, transacciones, ids UUID, snapshot de ventas), con cambios mínimos.

---

## 3. Opción A — `updatedAt + deletedAt` (sincronización por estado/cursor)

Modelo: cada entidad sincronizable tendría `id`, `createdAt`, `updatedAt`, `deletedAt`. El cliente sube lo
que cambió desde su `lastSyncedAt`; el servidor aplica por `id` (upsert) y el cliente descarga lo del
servidor con `GET /sync?since=...`. Los conflictos se resuelven con **Last-Writer-Wins (LWW)** por `updatedAt`.

**Ventajas**

- Muy simple: solo añadir 2 columnas + un cursor (`lastSyncedAt`) por negocio.
- Deltas naturales: solo viajan filas sucias; el resto no ocupa ancho de banda.
- **Idempotencia trivial** por registro: `INSERT ... ON CONFLICT (id) DO UPDATE` es idempotente por
  diseño; un registro repetido produce el mismo resultado.
- **Sin dependencia de orden**: si A llega después que B, `updatedAt` decide.
- Compatible con la abstracción actual de repositorios (cambios mínimos tipo `ensureColumn`).
- Fácil de testear y de implementar en ambos lados.

**Desventajas**

- **Depende del reloj del dispositivo.** Si el reloj de A y B difieren, el LWW se equivoca (una edición
  más nueva puede "perder"). Mitigación: servidor sella el estado aplicado y normaliza; o usar
  `updatedAt` solo como cursor y que el servidor lleve su propia `revision` monótona por negocio.
- **El estado oculta la intención.** Para stock, "stock = 5" no dice si fue por venta de 2 o ajuste
  manual; LWW de estado puede **borrar silenciosamente una venta** (ver Caso 5). Insuficiente para lo
  financiero/de inventario.
- **Borrados** requieren tombstone; si no, la baja nunca llega a otros dispositivos. Y los tombstones
  deben podarse con el tiempo.
- **Sin semántica de operación** en el servidor: no puede distinguir "pagar" de "editar cliente", ni
  validar transiciones (paid→pending) por estado puro; habría que añadir guards de todos modos.

---

## 4. Opción B — Outbox (cola local de operaciones)

Modelo: cada mutación escribe una operación en una tabla `outbox` **en la misma transacción SQLite** que
el dato. El Sync Engine lee operaciones pendientes en orden y las sube en lotes; tras el ACK del servidor,
las marca `synced`. Estructura típica:

```text
operationId | deviceId | entityType | entityId | operationType | payload | createdAt | attempts | status
```

**Ventajas**

- **Semántica exacta** por operación (create/update/delete/reserve/void/close) → el servidor puede
  validar (guards, stock) y auditar.
- **Idempotencia explícita y confiable** via `operationId`.
- Puede imponer o registrar **orden**; el server reproduce la secuencia del dispositivo.
- Maneja borrados con naturalidad (una operación `delete`).
- El servidor puede (con el ledger) **reconstruir el estado** o reconciliar stock.
- Detección de conflictos más fino si la operación lleva revisión base.

**Desventajas**

- **Más complejo:** instrumentar todas las mutaciones para escribir la outbox de forma atómica (doble
  escritura: dato + operación) y mantener ambos consistentes.
- **Crecimiento de la cola:** si el servidor no confirma, la outbox crece; hay que podar/archivar.
- **El rejuego debe ser a prueba de repetición**: la outbox solo se marca `synced` si el server
  confirma; un reinicio a mitad requiere reintentos con idempotencia en la aplicación server (no basta la
  operación, hay que guardar `processed_operations`).
- **Orden global indefinido** entre dispositivos (no hay reloj global); el orden solo es confiable
  dentro de un dispositivo.
- **El primer sync y el restore siguen siendo un problema aparte**: no hay historia de operaciones para
  los datos preexistentes a la cuenta; hay que importar un snapshot igualmente.
- Para catálogos es *overhead*: editar el precio de un producto no necesita una semántica de operación.

---

## 5. Comparación A vs B (cuadro)

| Criterio | A (`updatedAt+deletedAt`) | B (Outbox) |
| --- | --- | --- |
| Complejidad de implementación | Baja | Media-alta |
| Cambios en SQLite | Mínimos (2 columnas + cursor) | Nueva tabla + instrumentar escrituras |
| Idempotencia registro | Natural (upsert por `id`) | Explicitada por `operationId` |
| Idempotencia de reintentos | Trivial | Requiere `processed_operations` en servidor |
| Manejo de borrados | Tombstone + poda | Operación `delete` |
| Orden entre dispositivos | Irrelevante (LWW) | No resuelto (solo por device) |
| Relojes del dispositivo | Crítico (LWW) | Menos crítico |
| Stock / operaciones financieras | **Peligroso** (estado LWW pierde ventas) | Correcto (deltas aplicables) |
| Auditoría / reconstrucción | No | Sí (con ledger) |
| Crecimiento de cola | No aplica | Aplica (poda) |
| Compatibilidad con repos actuales | Alta | Media (más frentes de cambio) |
| Primer sync / importación inicial | Necesita snapshot igualmente | Necesita snapshot igualmente |

---

## 6. Análisis por entidad (lo que dicta la realidad de Vendelo)

### products

- `updatedAt`: Sí (cursor + LWW de campos editables como nombre/precio/categoría/imagen/activo).
- LWW: **Sí para campos de catálogo**, pero **NO para `stockQuantity`** (ver stock).
- ¿Operaciones?: No para edición; Sí para movimientos de stock (se modelan aparte, §inventory).
- ¿Orden estricto?: No.
- ¿Inmutable?: No.
- ¿Eliminable?: Sí.
- ¿Tombstone?: Sí (`deletedAt`).
- Dos dispositivos la modifican offline: LWW por `updatedAt` (el más reciente gana). Riesgo: relojes; se
  mitiga con `revision`/reloj lógico o normalización en servidor.
- Llega dos veces: upsert idempotente (mismo `id`).
- Llega fuera de orden: LWW lo absorbe (salvo skew de reloj).

### customers / providers

- Mismos criterios que products (catálogo puro, sin stock): `updatedAt` sí, LWW sí, sin operaciones,
  sin orden, no inmutable, eliminable con **tombstone**, upsert idempotente, fuera de orden absorbido por LWW.
- Nota: una orden histórica conserva la *copia* del cliente en la propia orden → borrar un cliente no
  rompe el historial.

### orders

- `updatedAt`: Sí, **solo como cursor** para "¿qué cambio desde la última sync?". **NO como regla LWW**.
- LWW: **No.** La fuente de verdad financiera es el **documento + la transición legal de estado**
  (`pending→paid`, `paid→voided`, `pending` edición/borrado). Un documento más viejo **nunca** debe
  pisar a uno más nuevo (jamás rewinding `paid→pending`).
- ¿Operaciones?: El ciclo de vida del documento (crear, pagar, anular, cancelar) se representa como
  **versiones del mismo documento** (`status`,`paidAt`,`voidedAt`, `updatedAt`) — no hace falta una
  outbox separada para la venta; el server valida transiciones en vez de rejugar operaciones.
- ¿Orden estricto?: Sí (guards de transición + versión monótona).
- ¿Inmutable?: paid/voided → sí (snapshot congelado). pending → editable/borrable (cancelar).
- ¿Eliminable?: Solo pending (cancelación). 
- ¿Tombstone?: Sí, para **órdenes pendientes canceladas** (hoy DELETE físico; en sync, `deletedAt`).
- Dos dispositivos la modifican offline: si uno edita la misma pending y otro la cobra → el **evento
  financiero gana**; el server rechaza la edición si ya está paid (409), el cliente vuelve a descargar.
- Llega dos veces: insert-if-absent por `id` + guard de transición → el segundo `paid` con mismo
  `updatedAt`/`paidAt` se responde **200 (ya aplicado)**; nunca hay doble venta.
- Llega fuera de orden (pending vieja tras paid nueva): **rechazada** (transición ilegal) → 409, el
  cliente resincroniza. No se usa LWW.

### order_items

- En la app actual: viven **dentro** de `orders.items` (JSON, snapshot). No son una tabla.
- Recomendación: **mantener como snapshot del documento de la orden** (fiel a la congelación de precio);
  en PostgreSQL pueden normalizarse a `order_items` pero como datos derivados **solo lectura**.
- `updatedAt`: no (heredan el de la orden). LWW: no. Inmutable en paid/voided. Sin régimen propio de sync.

### inventory (stock)

- `updatedAt`: no es suficiente. El stock es **estado derivado** de movimientos.
- LWW: **No** (borraría ventas offline — Caso 5).
- ¿Operaciones?: **Sí.** Se necesita un **ledger `stock_movements`** (append-only): cada reserva/liberación/
  anulación/ajuste es un registro `(id, productId, delta, orderId?, reason, deviceId, seq, createdAt)`.
  Esta es la **única parte donde sí hace falta una cola tipo outbox**.
- ¿Orden estricto?: El *cálculo* es conmutativo (suma de deltas); el orden importa solo para auditoría
  (usar `seq` por dispositivo para detectar huecos).
- ¿Inmutable?: Sí, un movimiento aplicado no se edita; las correcciones son movimientos nuevos.
- ¿Eliminable?: No (auditable).
- Dos dispositivos offline: el servidor **suma ambos deltas** y detecta **sobventa** (Caso 5).
- Llega dos veces: idempotencia por `id` del movimiento (insert-if-absent).

### cash closures

- `updatedAt`: No. LWW: **No**.
- ¿Operaciones?: **Append-only** (un insert por cierre). Snapshot inmutable.
- ¿Orden estricto?: No para la integridad (cada cierre es independiente); se conserva `closedAt`.
- ¿Inmutable?: Sí, completamente.
- ¿Eliminable?: No. Corrección → nuevo cierre (turno siguiente), nunca editar el histórico.
- Dos dispositivos: cierres distintos (cada caja/turno → su registro); sin conflicto entre ellos.
- Llega dos veces: insert-if-absent por `id`.
- Fuera de orden: no aplica (snapshots independientes), indexar por `closedAt` para reportes.

### business

- `updatedAt`: Sí. LWW: Sí (configuración del negocio; rara vez editada).
- ¿Operaciones?: No. Inmutable: No. Eliminar = borrar cuenta/cuenta. Tombstone: no aplica (fila única).
- Dos dispositivos offline: LWW; dos llegadas: upsert; fuera de orden: LWW.

---

## 7. Casos críticos

### CASO 1 — Producto (precio 100 vs 110 offline)

Debe resolverse con **LWW por `updatedAt`** del catálogo: gana el dispositivo cuyo `updatedAt` sea mayor
(eón: quien editó después). Para empates (mismo timestamp), determinismo (por ejemplo, gana el `id` mayor).

**Consecuencia para POS:** solo se conserva un precio en el catálogo. Las **ventas ya cobradas no cambian**
gracias al snapshot de ítems (CASO 3). Si el dueño necesita saber que hubo choque, el servidor puede
guardar una línea en `conflict_log` (opcional, informativa, sin bloquear). Advertencia: si los relojes de
los dispositivos están mal, LWW puede elegir "mal"; se mitiga con server-side "committed revision". No hay
solución perfecta sin un mecanismo de orden global; para el MVP de Vendelo LWW + relojes razonables es
aceptable en catálogos.

### CASO 2 — Venta offline pagada

Sincroniza como **documento inmutable, insert-if-absent por `id`**:

1. Server valida el documento (mismo criterio que `validateBackupData`: items, subtotal, cliente, fechas).
2. Guard de estado: `paid` recién llega; si el server ya la tenía `paid`, responde 200 (ya aplicada).
3. Server asigna el **número de factura global por negocio** (`invoice_number`) en ese momento (resuelve la
   colisión de `FAC` entre dispositivos).
4. Servidor aplica los **movimientos de stock** del documento (delta −cantidad) en la misma transacción.

### CASO 3 — Cambio de precio después de la venta

Garantía: la venta conserva **2 × RD$100** aunque el producto ahora cueste 120.

- El snapshot vive **en la propia orden** (`items[].product.priceCents`) desde su creación. El server **jamás
  recalcula** subtotales de una orden sincronizada; la orden es una factura congelada.
- La edición del producto (100→120) toca solo la fila `products`; las líneas históricas quedan intactas.
- Esto ya es la regla de Fase 12 de la app; solo se **mantiene igual** en el servidor (no reescribir).

### CASO 4 — Anulación tras reventa offline

- La venta (paid) ya está en el server o llega después; la anulación es una **versión nueva del mismo
  documento**: `status=voided`, `voidedAt`, `voidReason`, `updatedAt` mayor.
- El guard acepta únicamente transiciones **paid→voided** (y envío del mismo `voided` ya aplicado → 200).
- **Cómo evitar doble anulación:** comparación por versión/`updatedAt` + guard. Si el server ya está
  `voided` y recibe otra vez el mismo documento (mismo `id`, mismo `voidedAt`/`voidReason`), responde 200
  sin tocar nada. Nunca habrá dos registros de anulación.
- El movimiento de stock de la anulación (delta +cantidad) se aplica **una sola vez**, por `id` del
  movimiento vinculado a la orden.

### CASO 5 — Stock (A vende 2, B vende 3, hay 4)

Ambos dispositivos creen localmente que la venta es válida. Alternativas **comparadas**:

1. **LWW de `stockQuantity`:** el server conserva el stock de quien sincronizó después → la otra venta
   "desaparece" del inventario. **Inaceptable para POS**: el dinero ya se cobró y el stock queda con
   un conteo falso.
2. **Reserva en el servidor al sincronizar (segunda venta rechazada por falta de stock):** requiere
   **anular la venta 2 post-facto**, pero la venta ya está pagada y la app no reescribe pagadas. Iría
   contra la regla de inmutabilidad; solo viable con flujo explícito de anulación + aviso al dueño.
3. **Aplicar ambos deltas (ledger de movimientos) y marcar sobventa:** stock resultante = 4 − 2 − 3 = −1
   → se recorta a 0 y queda un **flag de reconciliación** "se vendieron 5 pero solo había 4; revisa el
   inventario". El dinero cuadra (ambas ventas son legítimas); el inventario se corrige con compra/ajuste.

**Recomendación para POS:** la opción **3 (movimientos + sobventa flag)**. No hay forma de impedir offline
que dos cajas vendan lo mismo; lo importante es **no perder dinero ni ventas** y que el dueño vea la
incoherencia para corregirla. (En un futuro multi-dispositivo, dado que la app ya bloquea con stock ≤ 0
local, el riesgo real se reduce si cada dispositivo atiende su propia bandeja/stock separado.)
Documentado además como decisión de producto: **una venta pagada nunca se rechaza ni se reescribe**.

### CASO 6 — Cierre de caja inmutable

- `cash_closures` se sincroniza como **append-only**: el server **no tiene endpoint de update/delete**
  para cierres y rechaza cualquier intento (409). La metadata `closedAt`/desglose es de solo lectura.
- La app tampoco edita: es la foto del turno (regla ya documentada en la auditoría: una anulación
  posterior al cierre no reescribe el turno, se manifiesta en el siguiente).
- Dos dispositivos no lo modifican: cada cierre es un registro independiente; el historial se compone
  del conjunto sincronizado.

### CASO 7 — Eliminación (producto borrado en A, B offline)

**DELETE físico:** B nunca se entera; el catálogo diverge para siempre y B puede seguir vendiendo un
producto eliminado (y si se usa el id para una venta nueva, conflicto). Inaceptable con dispositivos
múltiples.

**Tombstone (`deletedAt`):** A marca el producto como borrado (soft); el sync sube `deletedAt`; el
servidor lo propaga en `GET /sync?since=...`; B lo marca `deletedAt` local y lo oculta. Las ventas
históricas **no se rompen** porque los ítems llevan snapshot. Los tombstones se podan (p. ej. > 6 meses)
después de confirmarse en todos los dispositivos.

**Recomendación:** tombstone para catálogos y para órdenes pendientes canceladas; DELETE físico solo se
permite para "borrar cuenta" (paquete completo).

### CASO 8 — Retry (misma operación reenviada tras timeout)

1. El cliente envía el batch con `requestId` (p. ej. UUID) que ya usó antes (`operationId / requestId = ABC123`).
2. El servidor busca `sync_batches.request_id = ABC123`:
   - **Existe** → devuelve la **misma respuesta almacenada** (200 con el resultado original). No reaplica.
   - **No existe** → procesa el batch dentro de **una transacción**: valida, inserta datos (upsert/insert-if-absent),
     registra `requestId` + respuesta **en el mismo commit**. Si el commit se pierde (crash), el `requestId`
     tampoco existe → el reintento se procesa limpio y luego el armado del dedup lo cubre.
3. Aunque el batch se procese de nuevo en un caso extremo, los **ids de entidad (UUID)** hacen cada
   registro idempotente por sí mismo → el peor caso es un re-upsert, jamás una venta duplicada.

---

## 8. Idempotencia

### operationId (por operación) vs requestId (por request)

- **`operationId` (nivel registro):** para Vendelo es **el `id` UUID de la entidad** (order, product,
  customer, provider, closure, movement). Se genera en el **cliente, en origen, e inmutable**. El servidor
  usa `INSERT ... ON CONFLICT (id) DO ...` / `INSERT ... ON CONFLICT DO NOTHING`. Garantiza que **independentemente
  de cuántas veces llegue el registro, solo existe una instancia**.
- **`requestId` (nivel transporte/batch):** identifica un **lote HTTP**. Cubre el caso "el servidor procesó
  el lote pero perdimos la respuesta": permite devolver la respuesta guardada sin reprocesar.
- **Diferencia:** uno protege el **dato** (siempre idempotente por repositorio), el otro protege el
  **trámite** (no re-aplicar un lote y poder repetir la respuesta). Se deben usar **ambos**, con roles
  distintos. Un solo `requestId` por lote + ids naturales en cada registro.

### Tablas del servidor

- `sync_batches (id PK, request_id UNIQUE, business_id FK, device_id FK, status, response_json, created_at)`
  → idempotencia de lotes.
- **No es imprescindible** una tabla `processed_operations` aparte, porque las entidades ya llevan su
  clave natural `id` (UNIQUE). Se recomienda **`stock_movements`** como ledger (¡que es además el
  registro auditable de inventario), y un `conflict_log` informativo (opcional).
- Para órdenes: UNIQUE natural `orders.id` + **`invoice_number` UNIQUE por negocio**.

---

## 9. Orden de operaciones

Escenario: `1 crear producto → 2 cambiar precio → 3 eliminar producto` llega en orden `1, 3, 2`.

- Con **catálogos + LWW**: el orden de llegada no importa; la fila solo guarda el último `updatedAt`.
  La eliminación (tombstone) gana si su `updatedAt` es el mayor; un update 2 que llegue después con
  `updatedAt` **menor** se ignora (la fila está tombstonizada o el update es más viejo). Eso es correcto.
- Con **órdenes**: el orden lo da la **versión/transición** del documento (pending=1, paid=2, voided=3)
  más el `updatedAt`. El server aplica solo si: (a) la transición es legal desde el estado que **ya tiene**
  y (b) `version > version_comitted` (o igual → idempotente 200). Un evento más viejo (out-of-order) se
  **rechaza con 409** y el cliente resincroniza.
- Con **movements**: el cálculo es **conmutativo** (deltas aditivos); el orden de llegada no cambia el
  resultado. El `seq` por dispositivo detecta huecos (auditoría) pero no condiciona la aplicación.

**Conclusión:** no se necesita una **secuencia global**. Basta con: (a) `updatedAt` como cursor/LWW en
catálogo, (b) `version` + guards de transición en finanzas, (c) `seq` por device en stock. Dependencias
entre operaciones: solo las de orden de venta (orden → su anulación → su movement), que se resuelven por
parejas de lote y por `orderId` en el movement.

---

## 10. LWW: entidad por entidad (sin aceptarlo de forma genérica)

| Entidad | ¿LWW es apropiado? | Por qué |
| --- | --- | --- |
| products (campos de catálogo) | **Sí** | Edición de catálogo: "la última palabra gana". |
| products.stockQuantity | **No** | Estado derivado de ventas; LWW borraría ventas. → movements. |
| customers / providers | **Sí** | Catálogo puro. |
| business (configuración) | **Sí** | Configuración rara vez editada; última edición gana. |
| orders | **No** | Documento financiero: solo transiciones legales + versión. LWW permitiría rewinding pagadas. |
| pagos (received/change/method) | **No** | Parte del documento de la orden; una vez `paid` es inmutable. |
| inventory | **No** | Se sincroniza como movimientos (deltas), no como estado. |
| cash closures | **No** | Inmutables, append-only. |

Regla que guía la conclusión: **LWW solo donde la última edición es legítimamente la verdad (catálogos);
jamás donde el estado derivado es financiero o el registro es histórico.**

---

## 11. Offline-first (cómo debe funcionar la cola)

La app **no cambia su forma de trabajar**:

```
Internet OFF → crear → cobrar → stock → cerrar caja → seguir
Internet ON  → Sync Engine → sube pendientes → servidor confirma → ACK local
```

Diseño de la cola (mezcla, ver §15):

1. La app **escribe en SQLite como hoy** (sin esperar red).
2. En la **misma transacción**, el Sync Engine deja trazabilidad:
   - Catálogos (A): la propia fila con `updatedAt` nuevo → "pendiente" = `updatedAt > lastSyncedAt`. **No
     necesita cola** (el cursor es la cola).
   - Finanzas (Y): el documento (order/closure) con su `id` y `updatedAt` → igual, `updatedAt > lastSyncedAt`.
   - Inventario (B): los `stock_movements` con `pending` hasta ACK → **sí es una cola explícita**.
3. Al volver la red: `POST /sync` con un **lote** (catálogo sucio + documentos nuevos + movements pending)
   con un `requestId` nuevo. El `useDriveSync`/listener de red actual ya ofrece el punto de disparo.
4. Tras ACK: avanzar `lastSyncedAt` y marcar movements `synced`. Si falla: `attempts++`, reintento con
   backoff; **nunca bloquea la UI**.
5. Los lotes son **bounded** (p. ej. ≤ 500 registros o ≤ 5 MB) → una venta cobra y sincroniza, pero la
   app no lanza lotes gigantes que saturen.

---

## 12. Primer sync (usuario con datos locales que crea/entra a su cuenta)

Caso: 500 productos, 1 200 clientes, 3 000 ventas, inventario y cierres ya en el dispositivo.

**Alternativas comparadas**

- **A. Subir todo (upserts):** funcionalmente equivalente a importar en lotes. No hay un "commit" global;
  si falla a mitad, queda parcial (aunque reanuda). Más requests, más vueltas.
- **B. Backup inicial + sync incremental:** el dispositivo genera el **mismo bundle validado** que ya
  produce hoy (`serializeBackup`/`validateBackupData`, sanitizado sin credenciales), lo sube como un
  **snapshot atómico** con un `requestId`. El servidor: valida → inserta en **una transacción** → fija
  el **stock de apertura** (a partir del bundle: `products.stockQuantity` + derivación de movimientos de
  las `orders`) → fija el **cursor base** = `exportedAt`. Después, sync incremental normal.
- **C. Otra:** p. ej. sondear el server y solo subir diffs contra su estado → más complejo y sin beneficio
  cuando la cuenta es nueva (no hay estado previo en el servidor).

**Recomendación: B.** Encaja con Vendelo porque el bundle ya existe, ya es **validado** y **sin
credenciales**, es retrocompatible y el patrón de importación atómico (restore con cuarentena) también
existe. 3 000 ventas ≈ pocos MB → un solo upload es viable. El snapshot inicial se marca como tal en
`sync_batches` (`type='initial'`) para no mezclarlo con incrementales.

---

## 13. Nuevo teléfono (SYNC vs RESTORE)

| | SYNC incremental | RESTORE desde backup |
| --- | --- | --- |
| Objetivo | Mantener dispositivos existentes al día | Reconstruir el estado de un dispositivo |
| Mecanismo | `GET /sync?since=` | Descargar snapshot → validar → importar |
| Estado local resultante | Se reconstruye op por op (lento si 100k ops) | **Coherente e inmediato** |
| Cuándo usarlo | Cualquier dispositivo operando | Teléfono nuevo / teléfono perdido |

Flujo recomendado para el **teléfono nuevo**:

```
Instalar Vendelo → login/recovery → negocio → listar backups (/api/backups)
→ descargar el snapshot elegido → descifrar (clave derivada del password) → validar (validadores actuales)
→ aplicar (patrón de applyRestoredBundle: cuarentena → limpiar → importar) → fijar cursor = exportedAt
→ a partir de ahí, sync incremental
```

**No** se reconstruye un teléfono re-jugando el sync: es más lento, necesita re-aplicar idempotencia y no
produce un SQLite coherente al instante. **Restore es el bootstrap; sync es la vida cotidiana.** En el
nuevo dispositivo se registra además su propio `deviceId`.

---

## 14. Escalabilidad

### Volumen de ventas

| Ventas | Impacto esperado |
| --- | --- |
| 100 | Trivial. |
| 10 000 | SQLite del dispositivo: pocos MB; sync delta por cursor sin problemas; lotes de ≤500. |
| 100 000 | SQLite: ~100–200 MB en dispositivo (órdenes con snapshot JSON); considerar archivo limpio de
  ticket/historial antiguos; Postgres: particionar `orders` por mes (o retener solo head en la tabla
  principal y archivar). |
| 1 000 000 | Obligatorio: particionamiento de `orders`, índices `(business_id, updated_at)`, cursor por
  `since` sin rescan, snapshot de backups grandes a object storage; sync TIENE que ser incremental. |

### Multidispositivo

| Dispositivos | Consideraciones |
| --- | --- |
| 1 | Sin conflictos. Equivale al estado actual. |
| 2 | LWW catálogo + guards finanzas + movements: ya cubre el caso. Sobventas posibles (Caso 5). |
| 5 | Recomendar **stock por dispositivo/bandeja** (cada caja con su propio stock físico) para evitar
  sobventas; conflictos de catálogo raros; `deviceId` en cada movement. |
| 20 | Rate limiting por dispositivo, `sync` paginados por cursor, compactación de tombstones, alertas en
  `conflict_log`. Los lotes por dispositivo no crecen (cada uno sube solo lo suyo). |

### Contención de tamaño (diseño, no implementado)

- **Outbox:** solo `stock_movements` (append-only) + tombstones de catálogo; podar tombstones
  confirmados y movements `synced` > N meses (mantener resumen/modsuma si se necesita, o dejar ledger completo
  en Postgres y vaciar local).
- **SQLite:** los `items` JSON son lo más voluminoso; el cursor `since` + pruning de historial muy viejo
  (opcional) mantiene el tamaño acotado.
- **Ancho de banda:** solo deltas (filas sucias) + movements; las **fotos/imágenes NO viajan** en sync
  (son URI locales del dispositivo; en el futuro, asset remoto si se decide).
- **Requests:** `GET /sync?since=` con paginación (máx. N por página + nextCursor); `POST /sync` con lotes
  bounded y `requestId`.
- **PostgreSQL:** índices `(business_id, updated_at)` en `products/customers/providers/orders`,
  `orders(business_id, invoice_number)` UNIQUE, `sync_batches(request_id)` UNIQUE, `stock_movements(id)`
  PK + `product_id, created_at`.

---

## 15. Estrategia recomendada (híbrida, razonada)

**No es "solo Outbox" ni "solo updatedAt".** La realidad de Vendelo exige tres regímenes:

### Tier 1 — Catálogos y configuración (Opción A)
- **products (salvo stock), customers, providers, business**
- `updatedAt` + `deletedAt` (tombstone) + **LWW** + upsert por `id`.
- Cursor `lastSyncedAt`. Idempotencia natural por `id`. LWW absorbido el desorden.
- Regla: "la última edición es la verdad" (con la excepción de stock).

### Tier 2 — Documentos financieros inmutables (ni A ni B puros)
- **orders, cash closures**
- **Insert-if-absent por `id` UUID + guards de transición** (`pending→paid→voided`, versión monótona) en
  el servidor. **Nunca LWW. Nunca reescribir paid/voided.**
- `updatedAt` solo como cursor de "qué cambió" (no como autoridad de conflicto).
- Tombstone solo para **órdenes pendientes canceladas** y cierres = inmutables (append-only, sin update).
- Out-of-order → 409 + resync.

### Tier 3 — Operaciones derivadas: inventario (Opción B — la única outbox real)
- **`stock_movements`** append-only: cada venta/anulación/ajuste es un delta con `id` propio.
- El servidor **computa** stock = apertura + Σ movimientos, detecta **sobventa** y pone **flag de
  reconciliación** (no rechaza ventas pagadas).
- Idempotencia por `id` del movimiento; `seq` por dispositivo para auditoría; cálculo conmutativo.
- Es exactamente donde B es necesario (semántica de delta, no de estado).

### Servidor (capa transversal)
- **Idempotencia de transporte:** `sync_batches(request_id UNIQUE)` → respuesta repetible.
- **Idempotencia de datos:** claves naturales `id` (UUID) en todas las entidades.
- **Número de factura global por negocio** asignado una sola vez al confirmar órdenes nuevas.
- Validation idéntica a `validateBackupData` en la puerta de entrada.

### Evaluación del híbrido que proponías

Es correcto con matices:
- ✅ "Entidades editables → updatedAt + deletedAt": correcto para Tier 1.
- ⚠️ "Operaciones críticas → Outbox + operationId": en Vendelo las operaciones críticas **ya están
  encapsuladas en el documento-finanza** (orden con status/versión y signature stock). No hace falta una
  outbox de "pagar/anular": el documento + guards + movements lo cubren. Una outbox genérica ahí
  añade duplicación sin ganancia.
- ✅ "Servidor → idempotencia": sí, con requestId + claves naturales.
- ✅ "Históricos → inmutabilidad": cierres y paid/voided.
- ➕ **Lo que el híbrido original no decía y es decisivo:** el **stock necesita movements (ledger)**,
  no estado. Esa es la única cola/outbox imprescindible.

---

## 16. Arquitectura propuesta

```
┌─────────────────────────────────────────────┐
│             React Native (Vendelo)          │
│                                             │
│        SQLite (micaja.db)                   │
│   products/customers/providers (+upd/del)   │
│   orders + cash_closures (docs inmutables)  │
│   stock_movements (outbox/ledger)           │
│   sync_state (lastSyncedAt, deviceId)       │
│           │                                 │
│           ▼                                 │
│        Sync Engine                          │
│   Tier1: LWW por updatedAt (cursor)         │
│   Tier2: docs + guards (versión/status)     │
│   Tier3: movements pending (outbox)         │
│   Lotes bounded + requestId + ACK local     │
└───────────┼─────────────────────────────────┘
            │      HTTPS / JSON
            ▼
┌─────────────────────────────────────────────┐
│          ASP.NET Core Web API               │
│   Auth / Businesses / Devices               │
│   POST /sync  (requestId, lotes, guards)    │
│   GET /sync?since= (cursor, paginado)       │
│   Idempotency  → sync_batches (request_id)  │
│   Validation  → validadores tipo backup     │
│   Conflict   → LWW cats, guards finanzas,   │
│                sobventa flags, conflict_log │
│   Backups / restore / recovery codes        │
└───────────┼─────────────────────────────────┘
            ▼
┌─────────────────────────────────────────────┐
│        PostgreSQL                            │
│   Central state (negocio)                   │
│   orders (invoice_number UNIQUE x negocio)  │
│   stock_movements (ledger)                  │
│   sync_batches (idempotencia)               │
│   devices / sessions / recovery_codes       │
│   backups (metadata)                        │
└─────────────────────────────────────────────┘
            │  + object storage para backups grandes (IBackupStorage)
```

---

## 17. Plan de implementación (propuesto — NO ejecutar)

> Orden ajustado respecto al original: **F1 (SQLite) y F2 (contrato API)** son la base segura antes de
> tocar servidor. F5 (recuperación) puede ir en paralelo con F4, pero conviene primero el sync porque la
> recuperación necesita negocios/dispositivos persistentes.

- **FASE 1 — Preparar SQLite para Sync (solo app):** añadir `updatedAt`/`deletedAt` a products/customers/
  providers/orders (por `ensureColumn`), tabla `stock_movements`, tabla `sync_state` (deviceId,
  lastSyncedAt). Instrumentar movimientos en `orderService`/`stockService`. Sin red, sin cambios de IDs ni auth. Tests.
- **FASE 2 — Contrato de API:** `docs/API-DESIGN.md` con endpoints `/auth`, `/sync`, `/businesses`, `/devices`, `/backups`, request/response de lotes, idempotencia y códigos de conflicto (409).
- **FASE 3 — Backend: ASP.NET Core + PostgreSQL:** monolito modular (Auth, Businesses, Devices, Sync, Backups), EF Core (Npgsql) o Dapper + migraciones, Argon2, JWT+refresh (hash), rate limiting, anti-enumeración, autorización por negocio (anti-IDOR).
- **FASE 4 — Sync Engine:** `POST /sync` (requestId, lotes, guards de transición, invoice_number global, movements + sobventa) y `GET /sync?since=`; cliente con listener de red (reutilizar `useDriveSync`), ACK y backoff. Matriz de conflictos en tests del server.
- **FASE 5 — Recuperación de cuenta:** email/teléfono en registro, `forgot/verify/reset` con código temporal (hash + expiración + intentos), `ISmsSender`/`IEmailSender`, mensajes genéricos.
- **FASE 6 — Backup remoto:** `IBackupStorage`, `PUT/GET /backups`, SHA-256 servidor, cifrado del bundle con clave del usuario, metadata en PostgreSQL.
- **FASE 7 — Restore en teléfono nuevo:** flujo completo (login → listar backups → descargar → descifrar → validar → aplicar → cursor → sync). Reutiliza `applyRestoredBundle`.
- **FASE 8 — Multi-dispositivo real:** secuencia global de factura (ya en F4), sobventas y alertas, stock por bandeja/dispositivo, revocación de dispositivos, poda de tombstones y movements, particionado Postgres según volumen.

---

## 18. Riesgos pendientes (a resolver en fases posteriores)

1. **Relojes del dispositivo** para LWW de catálogo (mitigar con revision server / reloj lógico).
2. **Sobventa offline**: es un *flag de negocio* (reconciliación manual), no un error técnico; hay que
   notificarlo bien en la UI (no silenciarlo).
3. **Número de factura global**: migrar el correlativo local a `invoice_number` global sin romper el
   historial FAC existente.
4. **Imágenes** (fotos de producto, logo): hoy son URIs locales; decidir si se sincronizan como asset en
   F8.
5. **Tombstones**: política de retención/poda y confirmación multi-dispositivo.
6. **Ordenes pendientes canceladas**: hoy DELETE duro; migrar a tombstone para poder propagar.
7. **Clock/cursor**: `lastSyncedAt` debe ser robusto ante saltos de reloj (tolerancia o cursor por
   version/revision del servidor).
8. **Crecimiento de SQLite** con 100k+ ventas (snapshot JSON): plan de archivado/poda de historial.

---

## Validación (FASE 0.5 — solo documentación)

- `git status` antes: rama `main`, sincronizada; único cambio no tracking: `docs/BACKEND-AUDIT.md`
  (de FASE 0, pendiente de commit). No se tocó código en esta fase.
- Se ejecutarán al cierre de la fase: `npm test`, `npx tsc --noEmit`, `npx expo-doctor` (resultados en la
  respuesta de la sesión). Se espera: **258 tests / 31 suites, TypeScript limpio, Expo Doctor 21/21**;
  cualquier diferencia (preexistente) se documentará y no se arreglará en esta fase.