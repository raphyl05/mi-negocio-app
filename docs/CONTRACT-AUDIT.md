# Vendelo App — Auditoría del Contrato de API (FASE 2.2-A)

> **Fase:** 2.2-A — SOLO LECTURA. Este documento audita `docs/API-CONTRACT.md` (estado F2.2) para
> confirmar que **el contrato está listo para F3** (backend ASP.NET Core + PostgreSQL). No implica
> ninguna implementación y no modifica código ni el propio contrato: los hallazgos se **registran**
> para su resolución en la fase que se autorice (F3 o una corrección puntual de docs).
>
> **Reglas de esta fase:** sin cambios en `src/`, sin backend, sin dependencias, sin commit, sin push.
>
> **Base auditada:** `docs/API-CONTRACT.md` (1628 líneas, PARTES 1–48, integración F2.2 C1–C14).
> **Documentos de referencia:** `docs/CAPABILITIES-AUDIT.md`, `docs/BACKEND-AUDIT.md`, `docs/SYNC-STRATEGY.md`.

- **Fecha de auditoría:** 21/09/2026
- **Estado del proyecto:** 35 suites / 298 tests PASS (última ejecución en F2.2, sin cambios de código
  desde entonces); `tsc --noEmit` limpio; `expo-doctor` 21/21.

---

## 1. Alcance y método

1. Relectura completa del contrato (PARTES 1–48, incluidas las 9 nuevas PARTES 40–48 de F2.2).
2. Verificación de consistencia **interna** (partes entre sí, ejemplos JSON vs. esquemas, tablas vs. cuerpo).
3. Verificación de **referencias cruzadas** contra `BACKEND-AUDIT.md`, `SYNC-STRATEGY.md` y
   `CAPABILITIES-AUDIT.md` (secciones citadas, contradicciones declaradas en PARTE 36, GAPs de PARTE 29).
4. Auditoría de **completitud para F3** (backend): autenticación, negocios, capacidades, roles,
   catálogo, órdenes, inventario, caja, sync, backups, recuperación, errores, idempotencia.
5. Clasificación de hallazgos: **CRITICAL** (bloquea F3) / **HIGH** (incide en F3, resoluble antes de
   implementar el módulo) / **MEDIUM** (mejora necesaria de contrato, no bloquea) / **LOW** (errata o
   estilo, sin impacto) / **INFO** (aclaración o decisión futura).

**Resultado de severidad:** 0 CRITICAL · 1 HIGH · 5 MEDIUM · 8 LOW · 3 INFO.

---

## 2. Confirmaciones de consistencia (lo que SÍ cumple el contrato)

| # | Verificación | Resultado |
|---|---|---|
| V1 | Las 48 PARTES existen, sin duplicados; numeración contigua | ✔ |
| V2 | C1–C14 de `CAPABILITIES-AUDIT.md` mapeados y localizables (PARTE 48.1) | ✔ |
| V3 | Modelo híbrido (businessType informativo + capabilities autoridad + settings + capabilityVersion) aplicado coherentemente en PARTES 6, 14, 22, 40 | ✔ |
| V4 | Regla FEATURE_DISABLED consistente en PARTES 22.2, 23, 33, 34 y 40 (403 + `details.capability`) | ✔ |
| V5 | Regla anti-anónima idéntica en PARTES 10.1, 33, 42 (400 `anonymous_order`) | ✔ |
| V6 | `invoiceNumber` por negocio, asignado una sola vez por el servidor (PARTES 10, 11, 15, 33) — sin contradicción interna | ✔ |
| V7 | Inmutabilidad financiera: `paid`/`voided`/cierres/movimientos — PARTES 10, 12, 13, 16, 33 | ✔ |
| V8 | Stock = apertura + Σ movimientos; sin replay histórico en snapshot (PARTES 12, 25, 16 Caso 7) — alineado con `SYNC-STRATEGY §12-B`/`§15` | ✔ |
| V9 | Idempotencia a dos niveles (PARTE 15) con tabla `sync_batches(request_id)` adoptada de `SYNC-STRATEGY §8` | ✔ |
| V10 | Restore = bootstrap, sync = cotidiano (PARTES 18.4, 26) — alineado con `SYNC-STRATEGY §13` | ✔ |
| V11 | Tabla maestra de endpoints (PARTE 30) coherente con PARTES 5–14 en paths, métodos e idempotencia | ✔ |
| V12 | Catálogos con PK `(business_id, id)` (PARTE 2) — resuelve semillas fijas de `BACKEND-AUDIT §23-10` y §21 | ✔ |
| V13 | Contradicciones declaradas en PARTE 36 verificadas y ciertas (incl. las 6 de F2.2); ninguna bloqueante | ✔ |
| V14 | GAPs (PARTE 29) alineados con su resolución de fase (F3/F4) y con BACKEND-AUDIT/SYNC-STRATEGY | ✔ |
| V15 | Comanda vs factura: `prepStatus` ortogonal a `status` financiero, sin tocar el núcleo (PARTES 10.1, 43, 44) | ✔ |
| V16 | No-destrucción y drenaje de capacidades (PARTE 40.6) coherente con mesas/comandas (42.4, 43.4) | ✔ |

---

## 3. Hallazgos clasificados

### 3.1 CRITICAL (bloquean F3)

Ninguno. **No se detecta bloqueo** para iniciar F3: el contrato define entidades, estados, reglas,
errores, idempotencia y capacidades de forma coherente y auditable.

### 3.2 HIGH (inciden en F3; resolver antes de implementar el módulo afectado)

| ID | Parte | Tipo | Hallazgo | Recomendación |
|---|---|---|---|---|
| H1 | 5.2 / 32 | Gap de contrato | **El body de `POST /auth/register` no está definido.** PARTE 5.2 remite a "ejemplo PARTE 32.1", pero 32.1 es `login`. Se necesitan: `identifier` (email\|teléfono), `password`, `deviceId`, `deviceName`, `username?`, `businessId?/businessName?`, `capabilities?`. F3 implementa auth; sin este esquema el contrato queda vago en el punto de entrada del negocio. | Definir el esquema de `register` (p. ej. en PARTE 32) antes de codificar el módulo Auth de F3. No bloquea el arranque de F3 si es el primer entregable puntual del propio F3. |

### 3.3 MEDIUM (mejora de contrato, no bloquea)

| ID | Parte | Tipo | Hallazgo | Recomendación |
|---|---|---|---|---|
| M1 | 25.3 vs 30 | Ambigüedad | `POST /sync/initial` aparece como endpoint propio en la tabla maestra, pero PARTE 25 punto 3 propone "reutilizar `POST /sync/push` con `opType='initial'`, mejor". Dos caminos posibles para lo mismo. | Decidir uno (recomendado: `POST /sync/push` con `opType='initial'` para no añadir un endpoint paralelo) y eliminar/alinear la fila de PARTE 30. |
| M2 | 14.3 vs 32.4 | Inconsistencia de ejemplo | El pull real (PARTE 14.3) incluye `business` en `changes` (por F2.2), pero el ejemplo JSON 32.4 **no** lo incluye. Un implementador que copie el ejemplo perdería la propagación de `capabilityVersion`. | Actualizar el ejemplo de PARTE 32.4 para incluir `"business": []`. |
| M3 | 37 vs 41/22.1 | Contradicción interna | Decisión 17 dice roles "`owner` (F3), `cashier`/`viewer` PENDIENTE F8", pero PARTES 41.2 y 22.1 definen 6 roles (`owner/admin/cashier/waiter/kitchen/printer`) como parte del diseño actual, y PARTE 30 registra endpoints de membresías como "Tenancy". | Actualizar Decisión 17 (y el contador del título, ver L1) para reflejar que los 6 roles y membresías entran en F3/F4, o anotar expresamente que PARTES 41 prevalece. |
| M4 | 7 vs 41.3 | Ambigüedad de autorización | `device.role` "puede restringir aún más" (PARTE 7), pero no se define cómo se combina con `membership.role` (¿el dispositivo puede ABRIR permisos que la membresía no da? ¿contradicción?). Ej.: miembro `owner` en dispositivo con rol `waiter`. | Definir precedencia: **el rol efectivo = min(rol membresía, rol dispositivo)** (el dispositivo nunca amplía). Anotarlo en PARTES 7/22.1/41.3. |
| M5 | 6 / 6-capabilities | Gap de contrato | El body de `PATCH /businesses/{id}/capabilities` no está especificado (`{ businessType?, capabilities?, settings? }` se deduce pero no se escribe), y el de `POST /businesses` está parcial (`businessId`, `businessType`, `capabilities`). F3 los implementará. | Documentar los bodies exactos (ejemplo JSON) junto a PARTE 6 antes de codificar el módulo Business. |

### 3.4 LOW (erratas / estilo, sin impacto)

| ID | Parte | Hallazgo |
|---|---|---|
| L1 | 37 | Título "Decisiones explícitas (20)" pero la tabla tiene 28 filas (21–28 añadidas en F2.2). |
| L2 | 48.2-6 | Typo "Cancar comanda" → "Cancelar comanda". |
| L3 | 12 / 24 / 33 | Terminología inconsistente de sobreventa: `sobrenta` (12, 33) vs `sobreventa` (24) vs `sobventa` (24, 16-Caso7); además PARTE 12 usa "`APIERRE < 0`" que parece texto corrupto (¿"si el stock queda < 0"?). Unificar a "sobreventa" y corregir la expresión. |
| L4 | 14.1 / 6 / 30 | Typos: "**os** dispositivos" (14.1); "solo **o** identidad que ES dueño" (6 y 30). |
| L5 | 11.5 | Referencia "modo B Parte 26" — el Modo B está en PARTE 25 (Parte 26 es "Nuevo teléfono"). |
| L6 | 15 vs 22(#5) vs 31 | `sync_batches(request_id)` se describe como UNIQUE global (15/31) pero PARTE 22#5 dice "dedupe **por negocio**". Para UUIDs no hay colisión práctica, pero conviene fijar `(business_id, request_id)` UNIQUE. |
| L7 | 10 events[] | `events[]` es "append-only" pero no se define **quién** lo escribe (¿servidor en pay/kitchen? ¿cliente?) ni su endpoint; hoy solo viaja en el payload de la orden. |
| L8 | 5.1 | "refreshToken `40 min–48 h de rotación`" es ambiguo (¿duración o ventana de rotación?). Aclarar: p. ej. access 15 min, refresh rotativo activo 48 h, cadena 30 días. |

### 3.5 INFO (aclaraciones / decisiones futuras)

| ID | Parte | Nota |
|---|---|---|
| I1 | 5/30 | **Switch de negocio** no definido (`POST /auth/switch-business` o selector por `businessId`). Para la app actual (1 negocio) no bloquea; revisar en F6 (multi-negocio/roles). El token lleva `businessId` activo, luego hace falta un mecanismo para cambiarlo. |
| I2 | 45 | `printJobId` lo genera el cliente según PARTE 2, pero `POST /print-jobs/{id}/reprint` crearía el job en el servidor; definir si el servidor puede generar ids de print job (regla de PARTE 1.4: "el servidor solo genera ids para lo suyo"). |
| I3 | 44 | El descuento de stock al enviar a cocina (`KITCHEN_HOLD`) está reservado y NO implementado; confirmar en F8.1 sin cambiar el núcleo. |

---

## 4. Veredicto

**APROBADA PARA F3 CON OBSERVACIONES.**

- **0 CRITICAL** → no hay bloqueo para iniciar F3.
- **1 HIGH (H1):** definir el body de `POST /auth/register` como primer entregable puntual de F3 (antes
  de codificar Auth), o corregirlo en el contrato en la fase que se autorice.
- **5 MEDIUM (M1–M5):** resolverlas dentro de F3 al diseñar los módulos Sync/Business/Auth (M1/M5),
  y corregirlas en el contrato (M2/M3/M4) en un ajuste puntual de docs que se solicitará si se autoriza.
- **LOW e INFO:** mejoras editoriales y decisiones futuras, sin impacto en el arranque de F3.

Regla del roadmap: en ausencia de hallazgos CRITICAL, **F3 puede proceder** una vez autorizado por el
prompt maestro; ningún paso de esta auditoría avanza de fase por sí solo.

---

## 5. Reglas de referencia para F3 (confirmadas por esta auditoría)

1. Base path `/api/v1`; solo JSON; dinero entero en centavos; timestamps ISO 8601 UTC.
2. Auth: JWT 15 min con `(sub, businessId, deviceId, role, jti)` + refresh opaco hasheado rotativo;
   Argon2/bcrypt en servidor (el KDF local PBKDF2 jamás sale del dispositivo).
3. Capacidades: `businessType` informativo; `capabilities` autoridad; OFF = `403 FEATURE_DISABLED`;
   `capabilityVersion` viaja con `Business` (Tier 1 LWW); desactivar no borra datos (drenaje).
4. Roles: `owner/admin/cashier/waiter/kitchen/printer`; matriz PARTE 41.3 aplicada en servidor;
   rol efectivo = min(membresía, dispositivo) [según M4].
5. Órdenes: guards de transición + `version`; `invoiceNumber` secuencial por negocio, asignado una vez.
6. Sync: push ≤500 ops/4 MB en una transacción con `requestId`/`operationId` idempotentes; pull cursor
   opaco `v1:`; snapshot inicial sin replay de movimientos (apertura = stock del snapshot).
7. Inventario: `stock_movements` append-only + idempotentes por id; sobreventa se marca, no se rechaza.
8. Cierres: inmutables, por dispositivo; backups: bundle opaco + checksum SHA-256 + ≤50 MB.
9. `FEATURE_DISABLED`, `anonymous_order`, `INVALID_STATE`, `INVALID_CURSOR`, `CONFLICT`, `RATE_LIMITED`
   son los códigos funcionales de este contrato (PARTE 23).
10. Endpoints de cocina/impresión (PARTES 30, 43, 45) quedan **reservados** (F8/F9): F3 los soporta
    arquitectónicamente (campos y reglas de capacidad), no implementa el flujo.

---

## 6. Validación de la fase (solo lectura)

- Sin modificaciones de código ni de contrato en esta fase; 35 suites / 298 tests PASS re-verificados
  en F2.2 (commit idéntico, sin delta de código).
- Documento de esta fase: **`docs/CONTRACT-AUDIT.md`** (creado).
- Próximo paso autorizable: **F3** (backend según contrato) o ajuste puntual de docs para H1/M1–M5.