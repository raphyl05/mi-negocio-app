# Vendelo App — Auditoría de Capacidades del Negocio (F2.1 — diseño, no implementado)

> **Fase:** 2.1 — DISEÑO SOLO. Este documento NO implementa nada: no modifica código, no crea
> backend, no agrega dependencias, no hace commit ni push. Su objetivo es decidir la **arquitectura
> de capacidades** que convierta a Vendelo en un **POS universal multipropósito** (tiendas, colmados,
> cafeterías, restaurantes, bares, food trucks, vendedores ambulantes, pequeños comercios) donde las
> funciones de restaurante sean **opcionales y configuradas por negocio**.
>
> Relación con `docs/API-CONTRACT.md` (FASE 2): esta auditoría **documenta** todos los cambios que el
> contrato necesitará. **NO** se modifica `API-CONTRACT.md` durante F2.1; la integración se hará en
> una fase posterior autorizada (F2.2).
>
> **Reglas de la fase:** solo lectura + diseño + documentación. STOP al terminar.

---

## 1. Objetivo

1. Confirmar si `API-CONTRACT.md` soporta **capacidades por negocio** → **NO** (hoy `Business` solo
   tiene datos descriptivos y de ticket; el contrato no define tipo ni capacidades).
2. Definir qué se debe agregar para que el **tipo de negocio** sea solo información y las
   **capacidades** sean las que habilitan funciones.
3. Proponer el modelo (`business.type` / `business.features` / `business.settings` / híbrido).
4. Garantizar que la activación/desactivación **nunca destruye datos**.
5. Extensiones de `Order`/`OrderItem`/`OrderEvent` **sin romper** venta, facturación, inventario,
   caja, sync y backups.
6. Responder los 10 puntos de integración con F2.1.

---

## 2. Estado actual verificado en el código (F2.1)

| Código | Realidad |
|---|---|
| `src/models/business.ts` | `{ id?, name, ownerName?, phone?, address?, logoBase64?, invoiceMessage?, createdAt, updatedAt? }` — **sin `type`, sin `features`, sin capacidades, sin `capabilityVersion`** |
| `src/models/user.ts` | `{ id, username, passwordHash, passwordSalt, securityQuestion?, securityAnswerHash?, securityAnswerSalt?, createdAt }` — **sin roles** |
| `src/models/order.ts` | `{ id, number, items[], subtotalCents, customer, status, paymentMethod?, receivedCents?, changeCents?, createdAt, updatedAt?, paidAt?, voidedAt?, voidReason? }` — **sin mesa/mesero/cocina/eventos** |
| `src/screens/setup/SetupScreen.tsx` | registra nombre, dueño, usuario, contraseña, teléfono, dirección — sin tipo de negocio |
| `src/screens/settings/BusinessEditScreen.tsx` | edita nombre, dueño, teléfono, dirección, logo, mensaje de ticket — sin capacidades |
| `src/services/printer/*` | solo impresión de tickets/facturas; sin comandas de cocina |
| Búsqueda global | **0** referencias a waiter/mesero/mesa/table/kitchen/comanda/capability/feature en código |

**Conclusión verificada:** Vendelo es hoy un POS de mostrador puro, correctamente genérico, y no hay
nada de restaurante que "desactivar". Es el punto de partida ideal: la arquitectura de capacidades se
**añade** sin migrar código existente (todas las referencias son nuevas, opcionales y con default OFF).

---

## 3. Decisión: `business.type` vs `business.features` vs `business.settings` vs combinación

**Análisis:**

| Concepto | Sirve para | Problema si es el único |
|---|---|---|
| `type` (enum) | información descriptiva, onboarding/preset, analítica, estadística | NO puede comandar funciones: "restaurante sin mesas" o "colmado con cocina" lo rompen |
| `features` (flags booleanos) | activar/desactivar capacidades reales | sufren explode combinatorio; no llevan parámetros (p.ej. qué impresora de cocina) |
| `settings` (objetos/parámetros) | parametrizar una capacidad activa | sin un flag que diga "existe", no tiene ancla |
| **Híbrido** (`type` + `capabilities` + `settings` + `capabilityVersion`) | todo lo anterior, sin acoplar | — |

**DECISIÓN (recomendada):** modelo **híbrido de tres capas dentro de `Business`**:

```text
BUSINESS
├── businessType      → INFORMATIVO (nunca limita funciones)
├── capabilities      → LOS INTERRUPTORES reales (flags); DEFAULT: TODAS OFF
└── settings          → parámetros de cada capacidad activa
    └── capabilityVersion → entero que sube en cada cambio → distribución de caché offline
```

### 3.1 `businessType` (descriptivo)

```ts
businessType: 'COMMERCE' | 'RESTAURANT' | 'FOOD_TRUCK' | 'MOBILE_VENDOR' | 'SERVICE' | 'OTHER';
```

- Sirve para: preseleccionar capacidades al crear el negocio (preset editable), mostrar en informes,
  estadística del vendedor de la plataforma. **Jamás** se consulta para autorizar/ocultar funciones.

### 3.2 `capabilities` (los interruptores)

```ts
// Todas opcionales. DEFAULT: OFF → POS simple para todos.
type BusinessCapabilities = {
  // Familia restaurante (independientes entre sí, ninguna obliga a otra)
  restaurant?: boolean;      // contenedor UX/grupo (si NINGUNA sub-flag está ON, esto no muestra nada solo)
  waiters?: boolean;         // tomar órdenes con mesero
  tables?: boolean;          // asociar órdenes a mesas
  kitchen?: boolean;         // flujo de preparación (comandas)
  kitchenPrinting?: boolean; // enviar comandas a impresora de cocina

  // Futuras (reservadas; NO implementar en F2.1)
  delivery?: boolean;
  reservations?: boolean;
  branches?: boolean;
  shifts?: boolean;
  services?: boolean;
};
```

Reglas del modelo de capacidades:

1. **Cada capacidad es un interruptor independiente.** `tables` no exige `waiters`
   (aunque en la práctica una mesa sin mesero es rara, la combinación se permite por diseño).
2. **Ninguna capacidad es obligatoria por tipo.**
3. `restaurant` es un **contenedor de agrupación UX** (marca "este negocio usa funciones de
   restaurante"); **no** autoridad: la autoridad son los 4 sub-flags. Se puede tener
   `restaurant: true` y `tables: false` (negocio 2 del enunciado).
4. **Añadir una capacidad futura = agregar una clave booleana**, sin tocar el núcleo.

### 3.3 `settings` (parámetros por capacidad)

```ts
type BusinessSettings = {
  invoice?: { prefix?: string };          // reservado
  kitchenPrinters?: string[];             // deviceIds de impresoras de cocina
  currency?: 'DOP';                       // reservado (mono-moneda por ahora)
  // ...futuras; sin definir en F2.1
};
```

- `settings` solo tienen efecto si su capacidad está ON; si está OFF, se ignoran (no rompen nada).
- Nunca contienen datos operativos, solo configuración.

### 3.4 `capabilityVersion`

- Entero, parte de `Business`; **sube con CADA cambio de `capabilities`/`settings`** (y se refleja en
  `updatedAt`). Permite a los dispositivos detectar "mi caché de capacidades está vieja" y
  refrescarla en el siguiente sync (Parte 10).

---

## 4. Catálogo de capacidades (definición formal)

| Capability | Define | Dependencias recomendadas | DEFAULT |
|---|---|---|---|
| — Núcleo `pos`, `products`, `customers`, `inventory`, `cash`, `orders` | siempre ON; no es toggleable | — | ON |
| `restaurant` | grupo UX contenedor | ninguna (sub-flag = autoridad) | OFF |
| `waiters` | órdenes tomadas por mesero (`waiterId` obligatorio) | requiere al menos una sub-función de restaurante | OFF |
| `tables` | asociar órdenes a mesas | `waiters` (recomendado) | OFF |
| `kitchen` | flujo de preparación (comandas, `prepStatus`) | ninguna | OFF |
| `kitchenPrinting` | envío de comandas a impresora de cocina | `kitchen` (recomendado) | OFF |
| `delivery`, `reservations`, `branches`, `shifts`, `services` | futuras (reservadas, sin implementar) | — | OFF |

**Validación de consistencia mínima (puede proponerse en F2.2):**
- `waiters` ON **sin** `tables` ni otras flags: permitido (Negocio 2).
- `kitchenPrinting` ON con `kitchen` OFF: permitido técnicamente (impresión directa), aunque el
  presupuesto habitual es `kitchen ON`. Se documenta, no se obliga.

---

## 5. Regla de visibilidad (UI) y de no-destrucción

### 5.1 Visibilidad

- **Capacidad OFF** → el menú/Home no muestra ni expone la entrada ni la pantalla (Meseros, Mesas,
  Comandas, Cocina, Tickets de cocina). El POS queda simple e idéntico para todos los negocios.
- **Capacidad ON** → se muestra la entrada y su flujo asociado.
- Regla de implementación futura (F4/F8): un único selector `useCapabilities()` leído del `Business`
  local cacheado; TODOS los puntos de UI preguntan a ese selector (nunca a `businessType`).

### 5.2 No-destrucción de datos (regla fundamental)

> Desactivar una capacidad **NUNCA borra datos**: ni órdenes de cocina, ni mesas, ni meseros, ni
> tickets, ni historial, ni configuraciones.

- La desactivación solo hace dos cosas: (a) oculta la entrada en la UI; (b) el servidor **rechaza la
  CREACIÓN** de nuevas operaciones de esa capacidad (`403 FEATURE_DISABLED`).
- **No rechaza el cierre/lectura de lo pendiente:** si `kitchen` se apaga con comandas abiertas, los
  dispositivos siguen pudiendo **pasar a preparado/entregado o anular** esas órdenes pendientes
  (regla de "drenaje"), pero no crear nuevas comandas.
- Reactivar la capacidad restaura el acceso a **todo** lo que existía.
- Backups conservan `capabilities`/`settings`/`capabilityVersion` → restaurar preserva la
  configuración (sección 13).

---

## 6. Extensión de `Order` / `OrderItem` / `OrderEvent` (sin romper el núcleo)

**Principio:** las capacidades **extienden** el modelo de orden, nunca crean una "segunda app".

### 6.1 Campos nuevos en `Order` (todos opcionales; `undefined` = núcleo puro)

```ts
orderType?: 'counter' | 'waiter';        // 'counter' = POS normal; 'waiter' exige mesero
waiterId?: string;                        // = userId del mesero (Relación User→Waiter→Order)
waiterName?: string;                      // snapshot congelado para ticket (como customer/highlight)
tableId?: string;                         // id de mesa (si tables ON)
tableName?: string;                       // snapshot: 'Mesa 12'
prepStatus?: 'new' | 'sent' | 'preparing' | 'ready' | 'served'; // solo con kitchen ON
events?: OrderEvent[];                    // historial auditable in-memory/JSONB (ver 6.3)
```

- El **cálculo de dinero, factura, inventario y caja NO cambia**: el flujo `pending→paid→voided`,
  la congelación de precios y los `stock_movements` siguen igual con o sin capacidades.
- `orders` en SQLite/PostgreSQL: columnas nuevas **NULL por defecto** → filas existentes intactas,
  sync serializa solo los campos presentes (formato aditivo del contrato).

### 6.2 `OrderItem`

- Sin cambios: el snapshot `items[]` actual (productId, name, quantity, unitPriceCents,
  lineTotalCents) es suficiente. A futuro un item de cocina podría añadir `prepNote?` (nota de
  cocina por ítem) — reservado, no requerido.

### 6.3 `OrderEvent` (nuevo, opcional, solo para trazabilidad futura)

```ts
type OrderEvent = {
  id: string;
  type: 'created' | 'paid' | 'voided' | 'kitchenSent' | 'kitchenReady' | 'served' | 'cancelled';
  actorId?: string;        // = userId (mesero/cajero)
  at: string;              // ISO 8601 UTC
  detail?: string;         // opcional
};
```

- Se guarda como **append-only local/in-line** en la orden (JSONB), NO como tabla índice primero.
- El contrato lo trata como **metadato deducible**: si el servidor no lo recibe, lo reconstruye de
  las transiciones reales (no-reforzado, sin bloqueo).
- Nunca interfiere con `stock`, `invoiceNumber` ni cierres.

### 6.4 Regla mesa/cliente y anti-orden-pendiente-anónima

| Capacidad | Exigencia server-side | Respuesta |
|---|---|---|
| `waiters` OFF (POS mostrador) | cliente opcional, mesero/mesa prohibidos (si llegan → 400) | orden estándar |
| `waiters` ON | `waiterId` **OBLIGATORIO** (debe ser userId real con rol `waiter`) | 400 si falta |
| `waiters` ON | además: **MÍNIMO** uno de (`tableId | tableName | customer.customerName`) para evitar orden pendiente completamente anónima | 400 si ninguno |
| `tables` ON | `tableId` opcional; si va, debe existir y pertenecer al negocio | 404/403 |
| `customer` | siempre opcional excepto la regla anterior | — |

Ejemplos válidos (del enunciado):

```text
waiterId=Carlos, tableId=12          ✓ (mesa suficiente)
waiterId=Carlos, customerName=Pedro  ✓ (cliente suficiente)
waiterId=Carlos, tableId=12, cliente=Pedro ✓
waiterId=Carlos, sin mesa y sin cliente → ✗ 400 (anónima)
```

---

## 7. Relación `User → Waiter → Order` (regla del mesero)

**DECISIÓN:** el mesero **NO** es una entidad libre de texto ni un catálogo aparte. Es el **mismo
`User`** de la app con un **rol de miembro** en el negocio:

```text
users ──<memberships(business_id, user_id, role)>──> businesses
                                                       │
                                                waiterId = users.id
                                                       │
                                                 orders.waiterId ──> orders.waiterName (snapshot)
```

- Roles propuestos (PENDIENTE de implementar, irán en F3/F8): `owner` (todo + configurar
  capacidades), `cashier` (POS/caja), `waiter` (tomar órdenes con su propia identidad),
  `kitchen` (ver/actualizar `prepStatus` de comandas), `printer` (colas de impresión).
- El contrato de sync ya prevé `memberships` (API-CONTRACT PARTE 26 multi-tenancy); esta auditoría
  solo **etiqueta el rol** dentro de esa membresía.
- `orders.waiterId` se valida contra `users.id` (no texto libre); `waiterName` es SOLO snapshot de
  ticket.

---

## 8. Multi-dispositivo y roles por dispositivo

```text
BUSINESS
   ├── ADMIN    (configura negocio + capacidades; todo POS)
   ├── CASHIER  (POS normal)
   ├── WAITER 1/2 (toma órdenes; solo su propia bandeja)
   ├── KITCHEN  (ve y completa comandas)
   └── PRINTER  (imprime tickets/comandas en cola)
```

- `devices.role` (ver API-CONTRACT PARTE 7) se añade: `admin | cashier | waiter | kitchen | printer`.
- **Autorización:** un rol solo puede **usar** una capacidad si:
  1. la capacidad está ON en el negocio, **y**
  2. su rol tiene permiso para esa capacidad (matriz en sección 9).
- El rol `printer` solo consume colas de impresión; las comandas las gestiona `kitchen`.
- El servidor valida **incluso si la app estuviera manipulada** (la app solo filtra por UX).

---

## 9. Matriz de autorización por rol y capacidad

| Rol | POS/Caja/Inventario/Clientes | Configurar capacidades | `waiters` | `tables` | `kitchen` | `kitchenPrinting` |
|---|---|---|---|---|---|---|
| `owner` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `admin` | ✔ | ✔ (si el negocio lo permite) | ✔ | ✔ | ✔ | ✔ |
| `cashier` | ✔ | ✘ | (solo ver) | (solo ver) | ✘ | ✘ |
| `waiter` | (solo crear sus órdenes) | ✘ | ✔ | ✔ | ✘ | ✘ |
| `kitchen` | ✘ | ✘ | ✘ | ✘ | ✔ (ver/update prepStatus) | ✔ (enviar) |
| `printer` | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ (cola) |

Si el negocio NO tiene la capacidad, la matriz es irrelevante: **nadie** puede usar ese endpoint
(`403 FEATURE_DISABLED`).

---

## 10. Sincronización de cambios de configuración y caché offline

### 10.1 Cómo viajan los cambios

1. **Origen:** solo un `admin`/`owner` edita `Business` (setup → PATCH `/businesses/{id}` o el editor
   actual de la app).
2. `capabilities`, `settings` y `capabilityVersion` viven **dentro de `Business`** (Tier 1, LWW por
   `updatedAt`) → no hay infraestructura nueva: viajan en el `sync/push` de negocio y en el
   `sync/pull` como cualquier campo del negocio.
3. `capabilityVersion` se compara en cada dispositivo: si el local < el recibido → se refresca la
   caché de capacidades (simplemente: se guarda el Business nuevo; la UI se re-lectura).

### 10.2 Caché offline

- La app mantiene el `Business` en AsyncStorage/SQLite (hoy AsyncStorage; GAP→F4 mover a SQLite).
- **Uso offline:** la UI consulta la **caché local**; si la capacidad está ON localmente, puede
  operar aunque esté offline (coherente con offline-first). El **servidor** es el árbitro final al
  sincronizar y rechazará operaciones de capacidades que la caché no tenía (frente a desactivaciones).
- **Regla de convergencia:** si el admin desactivó una capacidad y un dispositivo la usa offline,
  el siguiente push de sus órdenes se **acepta para cierre** (drenaje, sección 5.2) pero se marca el
  `capabilityVersion` desactualizado → el dispositivo refresca y oculta la función.

---

## 11. Respuestas a los 10 puntos de integración con F2.1

1. **¿API-CONTRACT soporta capacidades por negocio?** No. `Business` (Partes 6 y 25) no tiene
   `businessType`, ni `capabilities`, ni `settings`, ni `capabilityVersion`.
2. **¿Qué debe agregarse?** El modelo híbrido de la sección 3 aplicado a `Business`; campos
   opcionales de `Order` (6.1); `OrderEvent` (6.3); rol en membresías y en `devices` (7 y 8);
   código de error `FEATURE_DISABLED`; reglas de validación (6.4); matriz de autorización (9).
3. **¿`business.features` es suficiente?** No: los flags no llevan parámetros ni versión. Se usa
   `business.type` (informativo) + `business.capabilities` (flags) + `business.settings`
   (parámetros) + `business.capabilityVersion` (caché). Es el **modelo híbrido**.
4. **Endpoints que deben considerar capacidades:** todos los de restaurante que **se agregarán en el
   futuro** (órdenes con `orderType=waiter`, comandas, mesas, meseros), más la **configuración**:
   `GET/PATCH /businesses/{id}` deben leer/escribir `type/capabilities/settings/capabilityVersion`,
   y `POST /devices` debe aceptar `role`. Los endpoints de núcleo (POS/Caja/Inventario) **no** se
   tocan.
5. **Cómo aplicar autorización:** chequear **dos condiciones**: (a) `capabilities[c] == true` en el
   negocio del token; (b) rol con permiso según matriz (9). Si falla → `403 FEATURE_DISABLED`.
6. **Cómo evitar endpoints de restaurante en negocios sin esas funciones:** la misma regla: el
   servidor devuelve `403 FEATURE_DISABLED` cuando la capacidad no está ON, **incluso** si la app
   manipulada intenta llamar; en el push de sync, las operaciones de esas capacidades se
   `rejected` sin borrado. La app jamás muestra la opción (capa 1) y el servidor la bloquea (capa 2).
7. **Cómo sincronizar cambios de configuración:** como parte del documento `Business` (Tier 1 LWW
   con `capabilityVersion`); ver 10.1.
8. **Cómo manejar múltiples dispositivos:** cada dispositivo cachea su copia; el admin es el único
   que escribe; los demás leen; la versión propaga la actualización; los roles se asignan por
   membresía/dispositivo (8).
9. **Cómo cachear las capacidades offline:** caché local del `Business` + `capabilityVersion`;
   operación offline permitida según caché; servidor arbitra al sincronizar (10.2).
10. **Cómo evitar inconsistencias al desactivar con órdenes pendientes:** regla de **drenaje**
    (5.2): no se crean operaciones nuevas, pero se **permiten el cierre/anulación/lectura** de las
    pendientes de esa capacidad. No se borra nada; reactivar restaura todo.

---

## 12. Compatibilidad futura (núcleo abierto, no cerrado a restaurante)

- Cualquier capacidad futura se define como **otra clave booleana** en `capabilities` (+ opcional
  `settings`), sin tocar `Order/Product/Customer/Inventory/Cash`.
- Lista reservada (NO implementar): `delivery`, `reservations`, `branches`, `shifts`, `services`,
  `production`, `purchaseOrders`, `turnos`.
- Convivir con lo existente: sync, cierres, backups e idempotencia ya modelados en API-CONTRACT se
  mantienen; las capacidades solo **añaden ramas** condicionadas por flags.

---

## 13. Cambios necesarios a `API-CONTRACT.md` (para F2.2 — NO aplicar en F2.1)

> Enumerados como **lista de cambios futuros**. F2.1 termina aquí; la edición del contrato requiere
> fase separada.

| # | Cambio al contrato |
|---|---|
| C1 | `Business`: añadir `businessType`, `capabilities`, `settings`, `capabilityVersion` (Partes 6/25) |
| C2 | Modelo `BusinessCapabilities` con flags `restaurant/waiters/tables/kitchen/kitchenPrinting` + futuribles |
| C3 | Modelo `BusinessSettings` (`invoice.prefix`, `kitchenPrinters`, `currency`) |
| C4 | `POST /devices` y `Device`: añadir `role: admin/cashier/waiter/kitchen/printer` (Parte 7) |
| C5 | Membresías: `membership.role` en multi-tenancy (Parte 26) |
| C6 | `Order`: campos opcionales `orderType/waiterId/waiterName/tableId/tableName/prepStatus/events[]` (Parte 10) sin romper núcleo |
| C7 | Nuevo tipo `OrderEvent` (auditable, append-only in-line) — Parte 10 |
| C8 | Validación server: regla mesa/cliente y anti-orden-anónima (Parte 10 - 6.4 de este doc) |
| C9 | Nuevo código de error `FEATURE_DISABLED` (HTTP 403) en Partes 23/34 |
| C10 | Autorización por capacidad en PARTE 22 (doble condición: flag + rol) |
| C11 | Sync: el `capabilityVersion` viaja con `Business` (Tier 1 LWW) — sin cambios de infraestructura |
| C12 | Backups: el bundle incluye `capabilities/settings/capabilityVersion` (el envelope v1 gana campos opcionales) |
| C13 | Esquema Postgres (futuro F3): `businesses.type/capabilities jsonb/settings jsonb/capability_version`, `memberships.role`, `devices.role`, `orders.*` nullable + `order_events` (opcional jsonb) |
| C14 | Matriz de roles×capacidades como tabla de referencia del contrato (sección 9) |

**Ninguno** de estos cambios es destructivo: todos son **aditivos y con default OFF/NULL**.

---

## 14. Impacto en los flujos existentes (verificación de no-rotura)

| Flujo | Impacto de capacidades OFF | Con capacidades ON |
|---|---|---|
| Venta normal (POS) | idéntico a hoy | idéntico + campos opcionales (si `waiters`, exige `waiterId`) |
| Facturación / `invoiceNumber` | sin cambio | sin cambio (mismas reglas; comanda no altera dinero) |
| Inventario / `stock_movements` | sin cambio | una venta de mesero genera los **mismos** movimientos SALE |
| Caja / cierres | sin cambio | la venta entra igual al cierre (por `paidAt`) |
| Sync / idempotencia / cursor | sin cambio | `Business` transporta la config; órdenes con campos opcionales (formato aditivo tolerante) |
| Backups | sin cambio | bundle gana `capabilities/settings/capabilityVersion` opcionales |
| SQLite local | sin cambio | columnas nuevas NULL; sin migración destructiva |

---

## 15. Propuesta de arquitectura final (objetivo)

```text
VENDELO
│
├── CORE (siempre ON)
│     POS UNIVERSAL · PRODUCTOS · CLIENTES · INVENTARIO · CAJA · ÓRDENES
│
└── CAPACIDADES OPCIONALES (por negocio, default OFF, sin destruir datos)
      ├── RESTAURANTE  (grupo contenedor)
      │     ├── MESEROS   (waiters)
      │     ├── MESAS     (tables)
      │     ├── COCINA    (kitchen)
      │     └── IMPRESIÓN DE COCINA (kitchenPrinting)
      └── FUTURAS: delivery · reservas · sucursales · turnos · producción · servicios
```

**Reglas invariantes:**
1. `businessType` es descriptivo; `capabilities` comanda.
2. Toda capacidad nueva = una clave booleana + (opcional) settings — el núcleo no se duplica.
3. OFF → invisible en UI + `403 FEATURE_DISABLED` en servidor; ON → según matriz de roles.
4. Desactivar nunca borra; reactivar restaura todo.
5. `Order` se extiende con campos opcionales + eventos; el dinero/inventario/caja no cambia.
6. La configuración viaja en `Business` con `capabilityVersion` (LWW Tier 1); offline usa caché;
   servidor arbitra.

---

## 16. Fases sugeridas (para referencia; NO ejecutar)

| Fase | Contenido |
|---|---|
| F2.2 | Integrar C1–C14 en `API-CONTRACT.md` (edición del contrato, autorizada separadamente) |
| F3 | Backend: `type/capabilities/settings/capability_version`, `memberships.role`, `devices.role`, `FEATURE_DISABLED`, reglas de orden |
| F4 | App: mover `Business` a SQLite (si se decide), persistir `capabilityVersion`, preparar `useCapabilities()`, campos opcionales de `Order` |
| F8 | UI de capacidades (Settings), presets por `businessType`, roles multiusuario y pantallas de meseros/mesas/cocina |
| F9+ | Capacidades futuras (delivery, reservas, etc.) como keys booleanas simples |

---

## 17. Validación de la fase (solo lectura)

- `npm test` → 35 suites / 298 tests PASS (ejecutado en esta fase).
- `npx tsc --noEmit` → sin errores (ejecutado en FASE 2, sin cambios de código entre ambas).
- `npx expo-doctor` → 21/21 (ídem).
- Sin modificaciones de código, sin nuevas dependencias, sin commit, sin push.
- Archivo creado en F2.1: **únicamente** `docs/CAPABILITIES-AUDIT.md`.

---

## 18. Veredicto final

**APROBADA CON OBSERVACIONES.**

- **Aprobación:** el modelo híbrido (`type` + `capabilities` + `settings` + `capabilityVersion`)
  cumple los requisitos: tipo no limita, capacidades opcionales e independientes, sin
  duplicar el núcleo, sin destruir datos, `Order` extensible sin romper venta/factura/inventario/
  caja/sync/backups, y los 10 puntos F2.1 quedan resueltos.
- **Observaciones (no bloqueantes):**
  1. La integración C1–C14 en `API-CONTRACT.md` **no** se aplica en F2.1 (requiere F2.2 autorizada).
  2. La matriz de roles multiusuario (owner/admin/cashier/waiter/kitchen/printer) depende de que F3
     agregue membresías y de F8 la UI; hoy la app es de dispositivo único.
  3. `OrderEvent` y `prepStatus` quedan definidos conceptualmente; no hay consenso final sobre si
     `order_events` será tabla o columna jsonb (se resolverá en F3, sin impacto en F2).

**STOP acordado:** fin de F2.1. No se implementa, no se edita el contrato, no se crea backend, no se
agregan dependencias, no hay commit ni push.