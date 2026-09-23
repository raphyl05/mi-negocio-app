# Vendelo App 🧾

Aplicación móvil de facturación/POS sencilla para pequeños negocios de comida rápida y vendedores ambulantes.
React Native + Expo + TypeScript. Funciona 100% offline (MVP).

---

## Estado actual

**Fase 1 COMPLETADA ✅** — proyecto creado, web habilitado, tipo de app configurado, repositorio conectado.
**Fase 2 COMPLETADA ✅** — sistema visual (tema turquesa/cian) + utilidad de dinero RD$ + tests.
**Fase 3 COMPLETADA ✅** — navegación: stack raíz + 4 pestañas (Inicio, Ventas, Productos, Más).
**Fase 4 COMPLETADA ✅** — configuración inicial del negocio (nombre, usuario y contraseña con hash).
**Fase 5 COMPLETADA ✅** — login local: verifica usuario + hash(SHA-256 con sal) y abre las 4 pestañas.
**Fase 6 COMPLETADA ✅** — apertura de caja: sin caja abierta no hay ventas; estado visible en Inicio y en "Más".
**Fase 7 COMPLETADA ✅** — facturación: catálogo de prueba, buscador, categorías y grid (agregar al carrito).
**Fase 8 COMPLETADA ✅** — carrito completo (+/−/eliminar) y panel opcional de datos del cliente.
**Fase 9 COMPLETADA ✅** — pago: al cobrar → "Cobrar" o "Guardar orden"; efectivo/transferencia con cambio automático y "Venta completada". Horas en a.m./p.m.
**Fase 10 COMPLETADA ✅** — productos CRUD (nombre, precio, categoría, estado), imagen por emoji/ícono/foto, stock opcional con descuento al vender y **globito rojo** de órdenes pendientes en la pestaña Ventas.
**Ajuste ✅** — cantidad manual editable en cada tarjeta de producto y botones − cantidad + más grandes/separados en el carrito.
**Fase 11 COMPLETADA ✅** — SQLite en Android/iOS (productos, stock y órdenes persistidas) con abstracción por repositorios: en memoria para web.
**Fase 12 COMPLETADA ✅** — órdenes guardadas funcionales (detalle, cobrar, editar carrito, eliminar, búsqueda) y ajustes de cantidades/teclado en pago.
**Fase 13 COMPLETADA ✅** — historial de ventas pagadas: nueva pestaña "Historial" con búsqueda y detalle de cada venta cobrada.
**Fase 14 COMPLETADA ✅** — resumen del día y cierre de caja: efectivo esperado vs contado, diferencia auto-calculada y registro del cierre desde "Más".
**Fase 15 COMPLETADA ✅** — abstracción `PrinterService` (sin imprimir aún) + hook inactivo `usePrinter` listo para conectar impresión cuando se decida.
**Fase 16 COMPLETADA ✅** — fixes críticos: scroll de facturación y stock atómico (tope en el carrito y revalidación al cobrar).
**Fase 17 COMPLETADA ✅** — stock siempre activo, renombrar categorías y ajuste rápido de precio/stock.
**Fase 18 COMPLETADA ✅** — pestaña Ventas unificada: Guardadas (borrado múltiple) y Cobradas (rango de fechas) + ticket pendiente.
**Fase 19 COMPLETADA ✅** — formato exacto de ticket con datos del negocio, logo base64 y vista previa (OrderComplete + OrderDetail).
**Fase 20 COMPLETADA ✅** — cierre de caja sin cambio devuelto + recibo de cierre imprimible.
**Fase 21 COMPLETADA ✅** — configuración del negocio y del usuario desde la pestaña Más.
**Fase 22 COMPLETADA ✅** — formato al perder el foco (RD$ y teléfonos) y limpieza de cliente al volver a facturar.
**Fase 23 COMPLETADA ✅** — código único de factura `FAC-NNNN` en cartas, ticket y detalle.
**Fase 24 COMPLETADA ✅** — directorio de clientes (CRUD) en Más → Clientes.
**Fase 25 COMPLETADA ✅** — teclado numérico estricto, edición de montos sin borrar y códigos de factura con letras variables tras `FAC-9999`.
**Fase 26 COMPLETADA ✅** — stock reservado al guardar pendientes y devuelto al cancelarlas; código FAC visible en pendientes y buscable; guardado de clientes desde facturación (sugerencias + botón); safe-area Android.
**Fase 27 COMPLETADA ✅** — directorio de proveedores (CRUD igual que clientes, más sección en "Más" y campo proveedor en los productos) + interfaz adaptativa: safe areas por plataforma (borde inferior solo en Android) y contenido centrado con ancho máximo en pantallas grandes.
**Fase 28 COMPLETADA ✅** — impresora configurable y funcional: pantalla en Más → Impresora (activar, buscar, conectar, imprimir prueba), impresión por el sistema/integrada con `expo-print`, soporte Bluetooth preparado para el módulo nativo (dev build), botones de imprimir donde corresponde solo con impresora activa y auto-reconexión cuando la impresora vuelve a encenderse.

**Fase 29 COMPLETADA ✅** — impresión rápida desde Ventas (pendientes y cobradas, con marca clara de pendiente/pagada), soporte tablet mejorado (ancho de contenido 840dp en pantallas ≥720dp y grilla de facturación de 3–4 columnas), respaldo/restore offline por archivo JSON y opción de borrar cuenta + datos desde Más → Datos y respaldo.

**Fase 30 COMPLETADA ✅** — sincronización con Google Drive: subida automática del respaldo completo tras cada cierre de caja, reintento automático al reconectarse (cola offline), descarga manual exclusiva vía "Restaurar desde Drive", cuenta persistente hasta desvinculación manual, sin congelar la app (subida en segundo plano).

**Fase 31 COMPLETADA ✅** — ajustes detallados de la versión actual:

- **Carrito:** la barra inferior (datos del cliente, subtotal y Continuar) queda **fija al pie de la pantalla**; ya no se centra ni le quita espacio a la lista de productos.
- **Mi negocio:** ahora incluye el **LOGO DE LA FACTURA** (elegir/cambiar/quitar) y el **mensaje del ticket** (editable, con "Gracias por su compra!" por defecto). Ahí viven todos los datos que salen en la factura; se eliminó la pantalla "Factura e impresión".
- **Datos y respaldo:** Google Drive y el "sync automático al cerrar caja" **quedaron fuera de la vista** (se retoman en una versión posterior). Solo respaldo/restore por archivo y borrar cuenta.
- **Cierre de caja:** la tarjeta ahora dice **EFECTIVO EN CAJA** y muestra el **total contado** (lo que hay físicamente en la bandeja, sin suponer); el cuadre comparativo contra lo esperado sigue reflejado como diferencia.
- **Caja cerrada = app bloqueada:** con la caja cerrada solo se puede editar el inventario; la pestaña **Ventas** queda bloqueada hasta abrir caja desde Inicio, y si había productos en el carrito se **limpian** al quedar la caja cerrada (todo empieza como un día nuevo).
- **Ventas:** se quitó la búsqueda por rango de fechas (Desde/Hasta).

**Fase 32 COMPLETADA ✅** — diseño afinado por tamaño de pantalla (iPads/tablets):

- **Datos del cliente a pantalla completa:** en el carrito, los datos del cliente ahora se abren como **pantalla completa** con botón **Continuar** (ya no es una hoja que sube desde abajo); el teclado se cierra al deslizar y el formulario queda en columna centrada.
- **Columna centrada de 560dp para formularios:** nuevo componente `Column` de 560dp de ancho máximo centrado, aplicado a todas las pantallas de formulario/confirmación: Configura tu negocio, Iniciar sesión y Recuperar contraseña, Carrito, Cobrar, ¿Cómo cobrar?, Venta completada, Detalle de orden, Mi negocio, Editar producto, Abrir caja, Resumen del día y Datos y respaldo. En teléfonos se ve igual que antes; en tablets/iPad el contenido queda compacto y centrado (estilo diálogo). Las listas (Inicio, Ventas, Productos, Ajustes) siguen con ancho fluido de 840dp.
- **Calendario de Ventas renovado:** corregido el bug de días duplicados en la semana y el rango Desde/Hasta ahora se elige desde cada campo (uno a la vez), se lista solo si queda invertido y permite limpiar por campo o el rango completo.

**Fase 33 COMPLETADA ✅** — transacciones atómicas en cobros/anulaciones + idempotencia de pago y anulación:

- **Repositorio transaccional `withTransaction(fn)`:** abstracción inyectable con **dos implementaciones** — `transaction.native.ts` (expo-sqlite real con `withTransactionAsync` en Android/iOS) y `transaction.ts` (passthrough/identidad para web y tests). `orderService` ahora ejecuta **guardar pendiente, cobrar, cobrar pendiente, cancelar y anular** **dentro de una transacción**: si algo falla a mitad (p. ej. stock insuficiente), **no queda nada a medias** (ni la orden guardada ni el stock descontado; todo vuelve a como estaba).
- **Idempotencia estricta (nunca dobles):** cobrar dos veces la misma orden → `"Esta orden ya fue cobrada."`; anular dos veces la misma venta → `"Esta venta ya fue anulada anteriormente."`; cancelar dos veces una pendiente **no devuelve stock dos veces**; el cambio/vuelto en efectivo se calcula una sola vez. Validado con tests.
- **Antidoble toque al cobrar:** en ¿Cómo cobrar?, el botón de cobrar queda **bloqueado al primer toque** (`submittedRef`) para que el doble tap no produzca un doble cobro ni por el sistema ni por BLE.
- **Stock devuelto de forma segura al anular:** anular una venta cobrada marca `voided` y **devuelve todo el stock de sus líneas en la misma transacción** (o se anula y se devuelve, o no pasa nada; nunca a medias).
- **Tests:** `__tests__/orderService.test.ts` (18 tests) con repositorios en memoria + `withTransaction` de identidad (SQLite jamás entra al entorno de test). Total: **203 tests, 24 suites, pasando** + `tsc --noEmit` limpio.

**Fase F3 COMPLETADA ✅ — backend Source of Truth (ASP.NET Core + EF Core 10 + PostgreSQL):**

- **Nuevo `backend/`** con API **ASP.NET Core Minimal API (net10.0)** + **EF Core 10** + **PostgreSQL 17** (en tests, SQLite por `Database:Provider`): se implementa el contrato `docs/API-CONTRACT.md` según `docs/BACKEND-F3-CONTRACT.md` (decisiones D1–D17).
- **Módulos:** auth (register/login/refresh/session, JWT 15 min + refresh rotativo 48 h/30 días, Argon2id server-side, recuperación placeholder), negocios (`businesses`) con `capabilities`/`settings`/`capabilityVersion` y `FEATURE_DISABLED`, dispositivos con rol propio (rol efectivo = membresía ∩ dispositivo), catálogo (productos/clientes/proveedores con tombstones), órdenes (create/pay/void con `paidAt`/`voidedAt`/`voidReason`, `invoiceNumber` secuencial del servidor, sobreventa flaggeada, anti-anónima), stock por ledger append-only (`stock_movements`), caja/cierres append-only, **sync pull/push** (cursor `seq:N`, dedupe por `requestId`, `action=delete` para soft-delete, bootstrap único `initial`, tombstones) y **backups** snapshot/restore.
- **Adopción del historial local:** el nuevo dispositivo de un negocio sube el snapshot inicial vía `opType='initial'` (Modo B); el servidor valida, aplica y responde el delta.
- **Tests de integración:** `dotnet test` → **40/40 pass** (auth, permisos/roles, VERSION_MISMATCH, dedupe sync, sobreventa, restore, sync delete + paid/void). Build limpio. App cliente intacta (341 tests + `tsc --noEmit` + `expo-doctor` 21/21).
- Informe de cierre: `docs/INFORME-F3.md`.

**Fase F3.1 COMPLETADA ✅ — auditoría del backend:**

- Auditoría 7/7 dimensiones (estructura, PostgreSQL, migraciones, índices, transacciones, errores, CORS) sobre `backend/`; veredicto **APROBADO CON ANOTACIONES** y anotaciones diferidas a F5/F4.1. Informe: `docs/INFORME-F3-1.md`.
- Sin commits ni push fuera de este registro; `src/` del cliente intacto.

---

## Fases de integración y sincronización

**Fase F5 COMPLETADA ✅ — Despliegue + PostgreSQL + Migraciones + Hardening:**

- **PostgreSQL 17** conectado y funcionando (Host: 127.0.0.1, Puerto: 5432, DB: `vendelo`, User: postgres, Auth: trust IPv4 / scram-sha-256 IPv6).
- **EF Core migration pipeline**: `dotnet ef migrations add InitialCreate` → `dotnet ef database update` → 15 tablas + audit_log aplicadas en PostgreSQL.
- **`appsettings.json` / `appsettings.Production.json`**: ConnectionStrings (Npgsql), Database:Provider, JWT config.
- **`Program.cs`**: `EnsureCreatedAsync` (esquema desde el modelo EF; las migraciones se generan con `dotnet ef migrations add Database__Provider=Npgsql` y aplican en despliegue/Postgres, no en runtime).
- **Audit log** (E3): `backend/deploy/001_create_audit_log.sql` — tabla + índices.
- **Deploy script**: `backend/deploy/deploy.ps1`.
- **Hardening**: logging 500 errores, JWT tokens secure, no sensitive data logged.
- Tests: 40/40 backend, 298/298 cliente, tsc limpio. INFORME: `docs/INFORME-F5.md`.

**Fase F5.1 COMPLETADA ✅ — Conectar cliente RN ↔ API:**

- **`src/config/api.ts`**: API base URL config (global/env/fallback), `apiUrl()` helper.
- **`src/services/apiTypes.ts`**: ApiError, ApiResponse, RequestInitExtended types.
- **`src/services/authApi.ts`**: apiFetch (auto-refresh on 401), apiLogin, apiRegister, apiRefresh, apiSession, apiLogout, token management.
- **`src/services/syncApi.ts`**: syncPull, syncPush, syncPushBatch.
- **`src/utils/network.ts`**: `isOnline()` via `@react-native-community/netinfo`.
- **`src/contexts/AuthContext.tsx`**: Rewritten with real API auth (login, register, logout, refreshSession, token scheduler, session restore).
- **`src/screens/login/LoginScreen.tsx`**: Uses apiLogin via useAuth; onForgot prop optional.
- **`src/screens/setup/SetupScreen.tsx`**: Tries apiRegister when online, falls back to local saveSetup when offline.
- **`App.tsx`**: Uses session from AuthContext.
- **`src/services/syncQueue.ts`**: Added syncPushData + API sync in processQueue.
- Tests: 298/298 pass, 35 suites. tsc: 0 errores. INFORME: `docs/INFORME-F5.1.md`.

**Fase F6 COMPLETADA ✅ — Multi-device sync (refactor completo 2026-09-23):**

- **`src/services/syncService.ts`**: Core sync service — syncPushData (desde cola real de cambios, 7 entity types, dedupe + chunking + markSynced), syncPullData (cursor-based, tombstones y server-wins), getLastCursor.
- **`src/services/syncChangeQueue.ts`**: cola de cambios pendientes (AsyncStorage, coalesce por `type:id`, `delete` gana) + `setSyncTrackingEnabled` (apagado durante pull/restore para evitar loops).
- **`src/utils/syncMapper.ts`**: mapeos puros cliente↔servidor (push `buildXBatch` / pull `xFromServer`), tombstones, `paidAt/voidedAt/voidReason`.
- **`src/hooks/useAutoSync.ts`**: auto-sync en reconexión/foreground — ensureSyncState + apiRegisterDevice + syncPushData + getLastCursor + syncPullData; estados y notificaciones.
- **Repositorios + caja**: enqueue de cambios en product/customer/provider/order/stockMovement y en `closeRegister` (cashClosure); `upsertCashClosureRecord`.
- Backend: device management (CRUD, roles), sync endpoints (pull/push) operativos; **`action=delete`** para product/customer/provider/order (soft delete + tombstone); órdenes con `paidAt/voidedAt/voidReason` (pull y push) y transición paid→voided; migración EF `OrderVoidFields`.
- **F6-1/2/3 (UI, 2026-09-23)**: `DevicesScreen` (listar/revocar, badge "ESTE EQUIPO") en Configuración; `BusinessSwitcherScreen` (cambio de negocio) + nuevo `POST /auth/switch-business` que re-emite sesión y crea el device en el negocio destino; PK de `Devices` ahora compuesta `(BusinessId, Id)` (migración `DeviceCompositeKey`) para que un equipo pueda pertenecer a varios negocios; refresh multi-negocio (`businessId` opcional en `POST /auth/refresh`, `activeBusinessId` persistido en el cliente); selector de rol de dispositivo en el login (`deviceRole` en login/register, validado contra `Roles.All` aplicado al device).
- Tests: **341/341** (cliente, 39 suites) + **44/44** (backend). tsc: 0 errores. expo-doctor: 21/21. INFORME: `docs/INFORME-F6.md`.

**Fase F7 COMPLETADA ✅ — Capacidades visibles:**

- **`src/services/authApi.ts`**: nuevos tipos `BusinessCapabilities` y `CapabilitiesResponse`; función `apiGetCapabilities(businessId)` que consulta `GET /businesses/{id}/capabilities`.
- **`src/contexts/AuthContext.tsx`**: estado `capabilities` cacheado por `businessId`; métodos `fetchCapabilities(businessId)` y `hasCapability(businessId, key)` disponibles vía `useAuth()`.
- **`src/screens/settings/ConfigurationScreen.tsx`**: nueva sección "CARACTERÍSTICAS DEL NEGOCIO" que muestra restaurant, meseros, mesas, cocina e impresión cocina con estado ACTIVA/INACTIVA según capacidades reales del negocio.
- Backend: `AccessService.RequireCapability()` y endpoints de capacidades operativos; `RequireCapability` listo para consumir en módulos restaurant (F8+).
- Tests: 298/298 pass, 35 suites. tsc: 0 errores. INFORME: `docs/INFORME-F7.md`.

**Fase F8 COMPLETADA ✅ — Comandas/Meseros:**

- **Modelo `src/models/order.ts`**: ampliado con `OrderType` ('counter'|'waiter'), `OrderPrepStatus`, `OrderEvent`, `CustomerData` con `customerId`, y campos `waiterId`, `waiterName`, `tableId`, `tableName`, `prepStatus`, `events` en `Order`.
- **`src/utils/order.ts`**: `buildOrder` acepta y propaga campos de mesero/mesa con defaults (`orderType='counter'`, `events=[]`).
- **`src/services/orderService.ts`**: `savePendingOrder` y `payNewOrder` aceptan `orderType`, `waiterId`, `waiterName`, `tableId`, `tableName`.
- **`src/services/syncService.ts`**: `toOrderBatch` incluye todos los campos de restaurante (`orderType`, `waiterId`, `waiterName`, `tableId`, `tableName`, `prepStatus`, `events`, `customerDescription`).
- **`src/contexts/CartContext.tsx`**: nuevo estado `waiter` (`WaiterInfo`), `isWaiterOrder`, `setWaiterOrder`, `setWaiter`.
- **`src/screens/home/InvoiceScreen.tsx`**: toggle "Modo mesero" visible cuando `waiters` capability está ON.
- **`src/screens/payment/PaymentScreen.tsx`**: pasa datos de mesero a `savePendingOrder`; muestra info de mesero en resumen.
- **`src/screens/payment/PaymentMethodScreen.tsx`**: propaga campos de mesero a `payNewOrder`.
- Tests actualizados (5 archivos) con `orderType` y `events`.
- Tests: 298/298 pass, 35 suites. tsc: 0 errores. INFORME: `docs/INFORME-F8.md`.

**Fase F8.1 COMPLETADA ✅ — Cocina:**

- **`src/models/kitchenTicket.ts`**: modelo KitchenTicket con id, orderId, orderNumber, prepStatus, waiterName, tableName, customerName, subtotalCents, itemCount, createdAt.
- **`src/services/kitchenApi.ts`**: `apiCreateKitchenTicket`, `apiUpdateKitchenStatus`, `apiCancelKitchenTicket`.
- **`src/screens/kitchen/KitchenScreen.tsx`**: pantalla de cocina con listado de comandas, badge de prepStatus, botones de avance de estado (sent→preparing→ready→served), cancelar comanda, y enviar a cocina. Visible solo con `kitchen` capability activa.
- **`src/models/order.ts`**: nuevo campo `kitchenTicketId` en Order.
- **Navegación**: KitchenScreen registrado en RootNavigator; botón "Ir a Cocina" en InvoiceScreen cuando kitchen capability ON.
- Backend: `KitchenEndpoints.cs` con 3 endpoints (crear/actualizar-status/cancelar), todos con `RequireCapability("kitchen")`.
- Tests: 298/298 pass, 35 suites. tsc: 0 errores. INFORME: `docs/INFORME-F8.1.md`.

**Fase F9 COMPLETADA ✅ — Impresión (vía F28/F29):**

- Impresión funcional desde OrderComplete, OrderDetail y VentasScreen (botón imprimir).
- `PrinterService` con transportes: Bluetooth, sistema, demo. Configuración en Más → Impresora.
- Reprint disponible: ordenes cobradas imprimibles desde VentasScreen.
- `PrintJob` model (`src/models/printJob.ts`) para trazabilidad de trabajos de impresión.

**Fase F10 COMPLETADA ✅ — Tiempo real:**

- **`src/contexts/NotificationContext.tsx`**: sistema de notificaciones toast (success/error/info/warning) con auto-dismiss a 3.5s.
- **`src/components/ToastHost.tsx`**: componente visual de notificaciones apiladas en pantalla.
- **`src/hooks/useAutoSync.ts`**: sync recovery con estado (idle/syncing/error), notificaciones al sync, reintento automático al reconectarse.
- **`src/screens/kitchen/KitchenScreen.tsx`**: polling cada 10s para actualizar estado de comandas + notificaciones de cambios.
- Tests: 298/298 pass, 35 suites. tsc: 0 errores. INFORME: `docs/INFORME-F10.md`.

**Fase A (distribución) COMPLETADA ✅ — configuración de publicación con EAS:**

- **`eas.json` creado** con perfiles `development` (dev client, APK), `preview` (internal, APK) y `production` (`autoIncrement: true`) + `appVersionSource: "remote"`; `submit.production` listo para Play/App Store.
- **`app.json` completado**: `android.package` y `ios.bundleIdentifier` = `com.vendelo.app`, `android.versionCode: 1`, `ios.buildNumber: 1`; icono de app apuntando a `assets/icon.png` (1024×1024); `adaptiveIcon.foregroundImage` corregido a `android-icon-foreground.png` (antes apuntaba al logo de 1254px); favicon web a `assets/favicon.png`; splash vía plugin `expo-splash-screen` (imagen `splash-icon.png`, fondo blanco).
- **`expo-updates` ~57.0.23 instalado** (versión exacta del bundle SDK 57) + `runtimeVersion` con policy `fingerprint` para OTA fixes sin reinstalar. Nota: hay que ejecutar `eas init` + `eas update:configure` para fijar el `projectId`/URL de EAS Update antes del primer build de OTA.
- `expo-doctor`: **21/21**; `tsc --noEmit` limpio; tests sin cambios.
- Próximo paso (bloqueado por credenciales/EAS login): `eas build` del perfil `preview` para validar el APK en dispositivo físico.

**Fase B (control de almacenamiento) COMPLETADA ✅ — el espacio que usa la app ya está acotado:**

- **Mantenimiento de BD (`database.native.ts`)**: nuevas funciones `checkpointDatabase()` (`PRAGMA wal_checkpoint(TRUNCATE)`, barato), `vacuumDatabase()` (`VACUUM`, reclama páginas de filas borradas) y `pruneSyncedStockMovements(180d)` (poda del ledger `stock_movements` que ya fue entregado al servidor; solo toca filas `synced = 1`).
- **`src/services/storageMaintenance.ts`**: al arrancar, sin bloquear la UI, poda archivos sobrantes de caché (cuarentenas `vendelo-pre-restore-*` viejas y exportes `vendelo-backup-*` compartidos), borra fotos huérfanas de `ImagePicker/` no referenciadas por ningún producto, poda movimientos síncronos antiguos, hace checkpoint del WAL y ejecuta `VACUUM` como máximo 1 vez cada 24 h (marcador en AsyncStorage). Conectado desde `App.tsx`; un listener de `AppState` hace checkpoint al pasar la app a segundo plano.
- **Respaldos automáticos** (`autoBackupService.ts`): además del tope de 5 archivos, ahora hay **tope por peso (25 MB total)** vía `planBackupPrune` (lógica pura en `src/utils/backupPrune.ts`); se descartan los más antiguos hasta caber.
- **Métricas visibles** en Más → Datos y respaldo: nueva tarjeta **ALMACENAMIENTO** con Base de datos, Caché de imágenes y Respaldos automáticos (tamaño y número) + botón "Actualizar tamaños" (`reportStorage()`).
- Tests: **309 en total, 36 suites, pasando** (11 nuevos: `planBackupPrune` y `planCacheCleanup` en `__tests__/backupPrune.test.ts`) + `tsc --noEmit` limpio.

**Fase C (fluidez) COMPLETADA ✅:**

- **Grid de facturación memoizado** (`InvoiceScreen.tsx`): `ProductCard` envuelto en `React.memo`; al tipear la cantidad ya no se re-renderiza toda la cuadrícula (solo la tarjeta editada gana foco). Handlers estables vía `useCallback` (con `quantitiesRef` para no tener que depender del estado en cada pulsación), y `filtered`/`categories` memorizados con `useMemo`.
- **Login/registro instantáneos en locales sin servidor**: nueva sonda `isApiReachable()` en `authApi.ts` que sondea `/api/v1/health` con timeout de **2.5 s**; si el backend no responde, `AuthContext.login` y `SetupScreen` pasan directamente a la validación/guardado local (antes había que esperar los 8 s del timeout del login). Cualquier respuesta HTTP (incluida 404/401) = servidor alcanzable.
- **Listas grandes virtualizadas**: `FlatList` de Ventas y Productos con `initialNumToRender`/`maxToRenderPerBatch`/`windowSize` acotados; el render inicial y el scroll con catálogos/órdenes extensos son más livianos.
- **Polling de cocina pausado en segundo plano** (`KitchenScreen.tsx`): el intervalo salta si `AppState` no está activo.
- **Contador de pendientes sin solapamientos** (`PendingOrdersContext`): guardia `inFlight` evita consultas duplicadas al cambiar de pestaña rápido.

**Fase D (sesión offline persistente) COMPLETADA ✅ — ya no se pide login de nuevo al reabrir/refrescar:**

- **Nuevo `src/utils/sessionStore.ts`**: persiste un snapshot de la sesión (usuario + marca offline) en AsyncStorage (`micaja.offlineSession`); `sessionFromSnapshot()` lo convierte en la sesión sin tokens lista para reabrir. Puro y testeado (7 tests).
- **`AuthContext` atado al arranque**: `restoreSession()` ahora, sin tokens, restaura la sesión guardada (offline o no) → el usuario vuelve a entrar sin tocar login. Con tokens pero servidor caído, **no borra nada**: conserva los tokens para reconectar y abre en modo offline con el snapshot. Solo desloguea ante rechazo de auth explícito o logout.
- **El snapshot se actualiza en cada sesión** (`storeSession`): al hacer login online se guarda `offline:false`, al entrar offline `offline:true`; `logout` lo elimina. Así un usuario que estuvo bien online ayer, hoy sin red, abre la app y sigue trabajando.
- Tests: **316 en total, 37 suites, pasando** + `tsc --noEmit` limpio.

**Fase E (recuperación de cuenta + respaldo en la nube + capabilities) COMPLETADA ✅ — se acabó el "no puedo entrar" y el "perdí todo":**

- **Recuperar cuenta por identificador real** (`LoginScreen` → "¿Olvidaste tu contraseña?"): ya no es un placeholder. Flujo completo en 3 pasos — ① ingresar email **o** telefone/marca (`identifier`) → `POST /auth/recovery/request` responde `requestId` + `expiresAt`; ② el **código OTP de 6 dígitos** recibido por SMS/email (`recovery/verify`); ③ nueva contraseña (`recovery/reset`) → se firma y guarda con el hash de seguridad nuevo. También accesible como `RecoverAccountScreen` con manejo de estado, contador y validación.
- **Backend de recuperación completo** (`backend/.../Auth/Recovery.cs`): tablas `otp_codes` y `recovery_sessions` (hash del código OTP con Argon2id, expiración 10 min, 3 intentos, reuso único), `POST /auth/recovery/request`, `POST /auth/recovery/verify`, `POST /auth/recovery/reset` (genera token JWT + rotación de refresh y sube `changeEpoch` para revocar sesiones viejas). Rate-limit en request/verify.
- **`register` con email + teléfono** ya no es optativo: el Setup y el login piden y validan ambos (`setupValidation.ts`), se firman y se guardan en el perfil del negocio.
- **RESPALDO EN LA NUBE funcional** (`Más → Datos y respaldo → RESPALDO EN LA NUEVA NUBE`): respaldo **self-servido** cifrado con **AES-GCM** (`Cipher.cs` + `StorageCipher`) — el servidor solo guarda/entrega el blob, no puede leer los datos; subida automática tras cierre de caja, lista de respaldos con fecha y botón "Descargar respaldo" para restaurar. La sección se activa/desactiva según la `capability` `cloudBackups` de la cuenta (`FEATURE_DISABLED` si no está contratada).
- **Capabilities del negocio visibles y operables** (`Más → Configuración → Tu negocio/Perfil`): UI de `capabilities` (cloudBackups, imprenta térmica, gestión de dispositivos...) cacheadas en `AuthContext`, editables con **versionado optimista** (`capabilityVersion` / `@version` ETag); el servidor rechaza escrituras obsoletas con **409 VERSION_MISMATCH** y la UI lo informa para reintentar. `GET /businesses/{id}/capabilities` + `PUT /businesses/{id}/capabilities`.
- Verificación: `dotnet build` **0 errores**, `dotnet test` **40/40 (backend)**, `tsc --noEmit` limpio, **316 tests de app pasando** + `expo-doctor` **21/21**.

---

## Auditoría técnica (endurecimiento) — Fases 0 a 19

Intervención controlada sobre la base de la auditoría del 19/09/2026 (plan BLOQ-1/B-02/BLOQ-2/BLOQ-3). Objetivo: estabilizar el núcleo financiero antes de usar datos reales. Reglas vigentes: no reescribir, cambios mínimos, una fase = verificación, no avanzar con errores. Estado: **Fases 0–17 completadas**; Fase 18 = este documento; Fase 19 = validación final e informe.

**Fase 0 COMPLETADA ✅** — mapa del flujo actual sin modificar nada: creación (CartContext → `orderService`), pago atómico e idempotente, stock reservado/liberado solo vía `stockService`, caja derivada en AsyncStorage (recalculada al cerrar), anulación `PAID→VOIDED`, backup/restore no transaccional (BLOQ-2 abierto), credenciales en AsyncStorage (Fases 5–7 pendientes), imágenes de caché (Fase 9 pendiente), migraciones ad-hoc y correlativo sin UNIQUE (Fases 10–11 pendientes).

**Fase 1 COMPLETADA ✅** — integridad de ventas:
- **Máquina de estados central** `src/utils/orderState.ts` (`assertOrderTransition`): flujo válido `pending→paid`, `pending→voided`, `paid→voided` (+ edición en el lugar de pendientes a nivel repo). **Una orden paid/voided no puede modificarse ni volver a el estado pendiente.**
- **Guardas aplicadas en repositorios**: `orderRepository` (en memoria) y `sqliteOrderRepository.native`. Un `update` ilegal lanza error; el doble cobro/doble anulación ya quedaba bloqueado en `orderService`; ahora también a nivel de persistencia. Restore sigue usando `save`/`remove` (no afectado).
- **Tests nuevos**: venta paid no modificable, paid no vuelve a pending, venta voided inmutable (no re-anular, no editar), y **historial conservado** tras anular (sigue en `listAll`, sale de paid/pending). Total: **207 tests, 24 suites, pasando** + `tsc --noEmit` limpio.

**Fase 2 COMPLETADA ✅** — transacción de pago:
- **Validación de stock DENTRO de la transacción**: `savePendingOrder` y `payNewOrder` ahora validan stock en el mismo `withTransaction` que guarda la orden y descuenta inventario (antes el chequeo era previo a la txn). Si algo falla: ROLLBACK, nunca "venta sin stock" ni "stock descontado sin venta".
- **Política de precio (decisión para Fase 12):** el precio se **congela al cobrar** (el que lleva el carrito/la orden guardada); al cobrar una pendiente NO se revalida contra el catálogo (el stock ya quedó reservado al guardarla, Fase 26) — una venta pendiente conserva sus líneas tal cual fueron guardadas.
- **Idempotencia verificada con tests:** doble cobro rápido de la misma pendiente → descuenta stock **una sola vez** y deja una sola venta pagada.
- **Tests nuevos (212 en total, 24 suites):** cobro con stock insuficiente a la primera (sin orden ni descuento), transferencia sin vuelto, doble cobro con stock único, y **rollback completo** si falla el descuento de stock o si la BD falla al confirmar (usa un `withTransaction` recuperable que restaura órdenes+productos) — en producción lo garantiza `withTransactionAsync` de SQLite.

**Fase 3 COMPLETADA ✅** — caja (apertura, ventas, cierre):
- **Política de anulación post-cierre (documentada, sin ocultar el problema):** el cierre de caja es una **foto del turno en el momento de cerrar** (snapshot inmutable). Una venta anulada DESPUÉS del cierre NO reescribe ese registro: la venta sigue visible como "Anulada" en el historial y el efecto de ese dinero se manifiesta en el **turno siguiente** (el conteo de la caja nueva detectará si la diferencia no cuadra). Las anuladas DENTRO del turno ya salen de los totales antes de cerrar (test que lo fija).
- **Registro de cierre ahora auditable y reconciliable**: cada `CashClosureRecord` guarda el **desglose completo del turno**: `orderCount`, `salesCents`, `cashSalesCents`, `transferSalesCents` además de apertura, efectivo esperado, efectivo contado y diferencia. Aunque anulen ventas del turno después, se puede reconstruir qué vendió ese cierre (fórmula lineal verificada: esperado = apertura + ventas en efectivo; las transferencias no cuentan para el efectivo).
- **Cierre endurecido**: `closeRegister` exige una caja abierta (`No hay caja abierta para cerrar`); sin ella **no se crea ningún registro** (imposible "cierres fantasma") y no se puede cerrar dos veces seguidas (doble tap). Al cerrar se guarda el desglose y se elimina la caja abierta. El recibo impreso (esperado / falta / sobra) no cambió.
- **Tests nuevos (218 en total, 25 suites):** apertura/lectura de caja, cierre con desglose completo + limpieza de caja abierta, rechazo de cierre sin caja abierta (cero registros), doble cierre bloqueado, y venta anulada fuera de `computeCashTotals` y de `isOrderInRegister`. `tsc --noEmit` limpio.

**Fase 4 COMPLETADA ✅** — restore seguro (respaldo/restauración):
- **Validación profunda ANTES de tocar nada**: `validateBackupData` en `backup.ts` comprueba campo por campo — productos (id, name, priceCents, stockQuantity, category, imageType, active, createdAt), órdenes (id, number entero ≥1, estado válido, items no vacíos con producto/precio/cantidad, subtotal, cliente completo, fechas, cambio ≤ recibido), clientes/proveedores (id, name, createdAt), cierres de caja (montos y fecha) y caja abierta. El error dice exactamente qué elemento falla (`Producto #3: falta "priceCents"`). Un archivo corrupto **no vuelve seguro a ser aceptado**: antes bastaba `app/version` y ahora se rechaza en la puerta de entrada.
- **Retrocompatible**: respaldos de versiones anteriores se aceptan — cierres antiguos sin el desglose nuevo, pueden faltar arrays (se tratan como vacíos), y no se exigen `paidAt`/`paymentMethod` en órdenes históricas (solo se valida su forma cuando existen).
- **Cuarentena pre-restauración**: antes de borrar nada, `applyRestoredBundle` escribe un respaldo de los datos ACTUALES en la caché (`vendelo-pre-restore-<timestamp>.json`). Así, si la restauración falla a mitad, los datos previos siguen existiendo y se recuperan con el mismo botón Restaurar. La guarda de validación corre también dentro de `applyRestoredBundle` (aunque alguien llamara a la función sin pasar por `parseBackup`, no puede destruir datos con un bundle inválido).
- **Tests nuevos (225 en total, 25 suites):** respaldo completo válido, producto sin precio, estado de orden inválido, items vacíos, cambio mayor que lo recibido, cliente con fecha inválida y cierre legado sin desglose. `tsc --noEmit` limpio.

**Fase 5 COMPLETADA ✅** — respaldo sin secretos:
- **El archivo de respaldo ya NO contiene credenciales**: el usuario se exporta **saneado** (`sanitizeUserForBackup`) — solo `id`, `username` y `createdAt`. Quedan FUERA `passwordHash`, `passwordSalt`, `securityQuestion`, `securityAnswerHash` y `securityAnswerSalt`. Si alguien obtiene el archivo no puede descifrar la contraseña ni usar la respuesta de seguridad.
- **Restaurar no trae contraseña**: tras restaurar, el usuario existe (mismo nombre de usuario) pero sin credenciales. `verifyLogin` ahora devuelve `null` si falta hash o sal (nadie entra con la contraseña vieja). En "¿Olvidaste tu contraseña?" se detecta la cuenta restaurada y se muestra **"Tu cuenta fue restaurada desde un respaldo y no tiene contraseña. Crea una nueva para ingresar"** → el dueño crea una contraseña nueva en el momento (flujo de `setNewPassword`, sin tocar el historial ni el negocio).
- **Tests nuevos (229 en total, 25 suites):** saneado del usuario (no exporta hash/sal/pregunta), el JSON exportado no contiene credenciales, no se puede iniciar sesión con cuenta sin credenciales y se puede crear una contraseña tras restaurar. `tsc --noEmit` limpio.

**Fase 6 COMPLETADA ✅** — contraseñas con derivación de claves (PBKDF2-HMAC-SHA256):
- **Adiós al SHA-256 de una pasada**: las contraseñas ya no se guardan con `SHA256(sal+contraseña)` (brute-forceable en segundos). Ahora se derivan con **PBKDF2-HMAC-SHA256, 100.000 iteraciones, sal aleatoria por usuario (16 bytes)** y se guardan como `pbkdf2$100000$<hex>` — mismo formato para la **pregunta de seguridad**. Todo **puro JS** (SHA-256/HMAC/PBKDF2 implementados y verificados contra vectores NIST/RFC), **sin añadir dependencias nativas**, offline-first.
- **Migración automática sin romper cuentas**: `verifyLogin` y `verifySecurityAnswer` detectan hashes antiguos (formato legado sin prefijo `pbkdf2$`), los verifican con el algoritmo viejo y, al tener éxito, **re-hashean al vuelo con PBKDF2 y sal nueva** (upgrade-on-login). Nadie queda fuera; las cuentas existentes se enduran en su primer acceso.
- **Comparación en tiempo constante** (`constantTimeEqual`) y rechazo de hashes corruptos (formato/iteraciones inválidas).
- **Limpieza en memoria/sesiones**: la sesión (`AuthContext`) guarda solo un booleano (`authed`) — el hash no se conserva en sesión; las pantallas piden el usuario por `getUser()` solo para mostrar el nombre. Y desde Fase 5 los hashes tampoco salen en los respaldos.
- **Tests nuevos (238 en total, 26 suites):** vectores oficiales de SHA-256 ("abc", cadena vacía), vector 1 iteración y vector 4096 iteraciones de PBKDF2-HMAC-SHA256, formato del hash, determinismo con la misma sal, verificación correcta/incorrecta y rechazo de hashes corruptos (la suite tarda ~35s porque ejecuta el KDF real de 100k iteraciones). `tsc --noEmit` limpio.

**Fase 7 COMPLETADA ✅** — credenciales en SecureStore (Keychain/Keystore):
- **Dependencia añadida**: `expo-secure-store` `~57.0.4` (la versión exacta de SDK 57, instalada con `npm install`; `npx expo install` falló por el reporte de `npm audit`, la versión correcta se comprobó contra `expo/bundledNativeModules.json`).
- **El usuario (hash, sal y pregunta de seguridad) ya NO vive en AsyncStorage en texto plano**: nuevo `src/utils/secureStore.ts` (llave segura `vendelo.user`). `setupService` guarda/lee/borra el usuario a través de esta capa → iOS Keychain / Android Keystore, protegido por el hardware del dispositivo.
- **Migración automática sin fricción**: la primera vez que se lee el usuario (login, boot, seguridad), si todavía hay un usuario legado en `@micaja/user` se **migra a SecureStore y se borra del lugar anterior**. Si SecureStore no está disponible (raro en Expo Go/dispositivos modernos), degrada a AsyncStorage con el comportamiento previo (no peor que antes). En **web** (sin keychain) sigue usando AsyncStorage, documentado.
- **Restaurar/borrar cuenta coherentes**: `applyRestoredBundle` escribe el usuario restaurado vía SecureStore y `deleteAccountAndData`/`clearSession` lo eliminan también del almacén seguro.
- **Tests nuevos (244 en total, 27 suites):** escribir/leer/borrar en SecureStore, migración del legado (se mueve y se limpia), prioridad del dato seguro sobre el legado, y que el hash de contraseña viaja por el almacén seguro (no por AsyncStorage). `tsc --noEmit` limpio.

**Fase 8 COMPLETADA ✅** — sesión sin exponer secretos:
- `verifyLogin` ya no devuelve el `User` completo (que contenía hash/sal/pregunta de seguridad). Ahora devuelve `SessionUser` (`{ id, username, createdAt }`), definido en `src/models/user.ts`. El hash solo se lee desde SecureStore dentro de la verificación y nunca se entrega a los callers (Login/Seguridad lo usan como booleano o lo ignoran).
- La sesión se mantiene únicamente como booleano `authed` en `AuthContext` (nada persistido, nada removible): `logout` la invalida y el BootGate vuelve a la pantalla de Login. No hay token que limpiar.
- **Tests (245 en total, 27 suites):** la sesión devuelta por login no expone `passwordHash` ni `passwordSalt`. `tsc --noEmit` limpio.

**Fase 9 COMPLETADA ✅** — ciclo de vida de fotos de producto:
- Nuevas utilidades en `src/utils/productImages.ts`: `isCachedPhotoUri` (solo considera fotos dentro del directorio de caché de la app) y `deleteCachedPhoto` (borrado en caché vía `expo-file-system/legacy`, best-effort, nunca toca `content://` ni URLs remotas).
- `ProductFormScreen`: al **guardar una edición** con foto cambiada o quitada (o imagen tipo cambiada a emoji/icono), se elimina la foto anterior de la caché; al **eliminar el producto**, se elimina su foto en caché. Se evitan archivos huérfanos que crecían sin límite en caché.
- **Tests (249 en total, 28 suites):** el filtro solo marca URIs dentro de la caché y rechaza archivos externos/`content://`/remotas. `tsc --noEmit` limpio.

**Fase 10 COMPLETADA ✅** — migraciones SQLite endurecidas:
- `openAndMigrate` resetea la promesa de la BD y reintenta si la apertura/migración falla (antes una falla dejaba la app rota para siempre).
- `ensureColumn` valida tabla y columna contra allowlist (`isValidSqlIdentifier`, nuevo `src/repositories/sqlIdentifier.ts`) antes de interpolar en el SQL.
- **Tests (251 en total, 29 suites):** allowlist de identificadores (acepta `products`/`order_meta`, rechaza `orders; DROP TABLE products`, comillas, espacios, números iniciales). `tsc --noEmit` limpio.

**Fase 11 COMPLETADA ✅** — correlativo de orden únicamente único:
- La tabla `orders` de las BD nuevas declara `number INTEGER NOT NULL UNIQUE`.
- Para las BD existentes (el UNIQUE no se puede añadir con ALTER TABLE) se intenta `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_number_unique ON orders (number)`; si el historial heredado tuviera duplicados, el índice se omite sin romper ni modificar datos y el correlativo se sigue reservando de forma atómica vía `order_meta.nextNumber`.
- **Tests (251, 29 suites)**: sin cambios. `tsc --noEmit` limpio.

**Fase 12 COMPLETADA ✅** — política de precios congelados (documental):
- El precio de venta se **congela al crear la orden**: cada ítem guarda `unitPriceCents` copiado del precio del producto en ese momento (`src/utils/order.ts`, `src/utils/cart.ts`). Cobrar una orden pendiente **no recalcula** contra el precio actual del catálogo, de modo que subir/bajar un precio después nunca altera ventas ya registradas. (Implementado desde el diseño de la transacción y documentado aquí para la auditoría.) Sin cambios de código en esta fase.

**Fase 13 COMPLETADA ✅** — cierre de huecos de prueba:
- Nueva suite `__tests__/orderState.test.ts` con la **matriz completa de transiciones** del estado de orden (`assertOrderTransition`): pending→paid/voided permitidas, paid→voided permitida, paid→paid (re-edición) bloqueada, voided→cualquiera bloqueada, vuelta a pending bloqueada. Garantiza el pilar de "no reescribir ventas pagadas/anuladas".
- **Tests (255 en total, 30 suites).** `tsc --noEmit` limpio.

**Fase 14 COMPLETADA ✅** — dependencias saludables:
- `npx expo-doctor`: pasó de 19/21 a **21/21 checks**.
- **Añadida** `expo-font@~57.0.4` (peer dependency de `@expo/vector-icons`; faltaba para builds nativos fuera de Expo Go; versión oficial SDK 57 tomada de `expo/bundledNativeModules.json`).
- **Deduplicada** `expo-constants@57.0.19` (existían 3 copias anidadas de la misma versión; `npm dedupe` las colapsó). 
- `npm audit`: quedan **11 moderadas transitivas del tooling de Expo** (`@expo/config`, `@expo/config-plugins`, `prebuild-config`, `metro-config`) — son de build, no del código de la app. `audit fix --force` rompería SDK 57; decisión: **no tocar**, documentado.
- Tests y typecheck siguen en verde (255/30).

**Fase 15 COMPLETADA ✅** — documentación del backend previsto:
- Nuevo `docs/BACKEND.md` con la arquitectura recomendada (**TypeScript + Fastify + PostgreSQL**), cómo consumirá la app el servidor (sincronización batch `POST /sync`, respaldo `PUT /backups`, autenticación **PBKDF2 100k it en el cliente**, sin credenciales del usuario fuera del dispositivo), los límites para no contaminar el offline-first (no reescribir ventas pagadas/anuladas, caja = snapshot local) y las pruebas obligatorias del backend. Alinea la recomendación previa de la Fase 32 (ASP.NET Core) con la decisión de auditoría. No hay servidor en este repo; MVP 100% offline.

**Fase 16 COMPLETADA ✅** — respaldo automático local:
- Nuevo `src/services/autoBackupService.ts`: tras **cada cierre de caja** se escribe un respaldo completo (mismo bundle sanitizado y sin credenciales) en `documentDirectory/vendelo/respaldo-auto-*.json`, reteniendo **los últimos 5** (poda automática, best-effort, nunca interrumpe el cierre).
- Restaurar ese archivo es exactamente igual que el respaldo manual (Más → Datos y respaldo → Restaurar); no se restaura solo al arrancar para no pisar datos sin confirmación.
- Bug de pruebas corregido de paso: el `moduleNameMapper` de jest usaba `Sqlite` (mayúscula) pero los imports son `sqlite` (minúscula) → el repositorio lazy nunca se stubeaba en tests y resolvía la implementación nativa; corregido con el patrón `sqlite...`.
- **Tests (258 en total, 31 suites):** escritura del snapshot, poda a 5, y que el cierre de caja genera su snapshot sin fallar. `tsc --noEmit` limpio.

**Fase 17 COMPLETADA ✅** — Google Drive (decisión del usuario: **conservar documentado**):
- `driveService.ts` queda **dormido e intacto**: código completo (OAuth con PKCE, subida automática post-cierre, listar, descargar, revocar) pero con `GOOGLE_CLIENT_ID = ''` y sin acceso en la UI (Fase 31/32). `signInDrive` devuelve error si el ID está vacío → imposible subir datos sin configuración explícita.
- Para reactivarlo: configurar `GOOGLE_CLIENT_ID` en `src/services/driveService.ts` (OAuth 2.0 Client ID en Google Cloud Console) y volver a exponer las acciones en Más → Datos y respaldo. No se eliminó ninguna dependencia (`expo-auth-session`, `expo-web-browser`).

> **IMPORTANTE:** este README es la guía de retorno. Si retomas el proyecto después de tiempo, lee esto antes de escribir código.
> Además, existe `AGENTS.md` en la raíz que indica revisar la documentación de Expo SDK 57:
> https://docs.expo.dev/versions/v57.0.0/

### Hecho (Fase 1)

- [x] Proyecto **Expo SDK 57** + **React Native 0.86** + **TypeScript 6** creado con plantilla `blank-typescript`.
- [x] Nombre de la app: **"Vendelo App"** con logo `logo-vendelo-app.png` (`app.json`). Slug: `vendelo-app`.
- [x] Soporte web para previsualizar en navegador (`react-dom` + `react-native-web`). **Verificado:** bundle web compila (`npx expo export --platform web`).
- [x] Verificación: `npx tsc --noEmit` pasa sin errores.
- [x] Git: rama `main`, remoto `https://github.com/raphyl05/mi-negocio-app`. Subido y actualizado.
- [x] Estructura base del proyecto lista.

### Hecho (Fase 2)

- [x] Theme centralizado en `src/theme/`: colores (turquesa `#00B8A9`), espaciados, tipografía, sombras, `ThemeProvider` + hook `useTheme`.
- [x] `src/utils/money.ts`: `formatMoney` (RD$ con miles y centavos, permite negativos y ocultar decimales) + `calcSubtotal`, `calcChange`, `calcDifference`. Todo en **centavos (int)**.
- [x] Componentes base del sistema visual: `Card` (blanca, redondeada, sombra suave), `PrimaryButton` (grande, variantes primary/outline, feedback al tocar), `MoneyDisplay` (números grandes tabulares).
- [x] Pantalla de previsualización del tema en `App.tsx` (marca MiCaja + tarjeta de ventas + botones) para verlo en el navegador.
- [x] Testing con **Jest** (`jest-expo`): 9 tests de dinero, 100% pasando. Scripts `npm test` y `npm run typecheck`.
- [x] Dependencia nueva justificada: `react-native-safe-area-context` (oficial Expo, áreas seguras en teléfonos; la navegación la usará).

### Hecho (Fase 3)

- [x] Navegación con **React Navigation 7**: `@react-navigation/native` + `bottom-tabs` + `native-stack` + `react-native-screens` (versiones fijadas por npm directo, ver nota EALLOWSCRIPTS).
- [x] `src/navigation/types.ts` con `RootStackParamList` (stack raíz; aquí se conectan después Setup/Login/Apertura de caja) y `TabParamList` (4 pestañas).
- [x] `RootNavigator` (NavigationContainer + stack) y `BottomTabs` (Inicio, Ventas, Productos, Más) con iconos `@expo/vector-icons` (Ionicons), color activo turquesa y barra blanca.
- [x] Pantallas base conectadas al tema: `HomeScreen` (previsualización MiCaja), `SalesScreen`, `ProductsScreen`, `SettingsScreen` (con `EmptyState`).
- [x] Componentes auxiliares: `Screen` (SafeArea + fondo del tema) y `EmptyState` (placeholder elegante).
- [x] Verificado: typecheck OK, 9 tests OK, bundle web compila.

### Hecho (Fase 4)

- [x] Modelos `business.ts` y `user.ts`.
- [x] `expo-crypto` (SHA-256, funciona en Android/iOS/Web): `src/utils/password.ts` con `hashPassword` (solo hash con sal, nunca texto plano), `generateSalt` y `generateId`.
- [x] `@react-native-async-storage/async-storage`: `src/services/setupService.ts` guarda negocio + usuario; si ya hay negocio, el arranque **salta la configuración**. Decisión: config/sesión en AsyncStorage, datos de ventas en SQLite (Fase 11).
- [x] Pantalla **"Configura tu negocio"**: nombre*, usuario*, contraseña* + confirmación (opcionales: propietario, teléfono, dirección), validaciones con mensajes claros, botón grande CONTINUAR con estado de carga y pantalla de confirmación "¡Todo listo!" → Login.
- [x] Lógica de arranque en `App.tsx` (`BootGate`): splash → Setup si no configurado → Login placeholder (se completa en Fase 5).
- [x] Componente `TextField` (redondeado, borde turquesa al enfocar, mensaje de error en rojo).
- [x] Tests: `validateSetup` (16 tests en total, pasando).

### Hecho (Fase 5)

- [x] `verifyLogin` en `src/services/setupService.ts`: compara hash del usuario guardado (usuario sin distinguir mayúsculas, contraseña vía SHA-256 con su sal). Nunca revela cuál campo falló.
- [x] `src/screens/login/LoginScreen.tsx` real: usuario + contraseña, validaciones, banner rojo "Usuario o contraseña incorrectos", botón ENTRAR con estado de carga.
- [x] `App.tsx` (`BootGate`): login exitoso → `RootNavigator` (4 pestañas: Inicio, Ventas, Productos, Más). La 4.ª pestaña se conectará en la Fase 6.
- [x] Tests: `validateLogin` (19 tests en total, pasando).

### Hecho (Fase 6)

- [x] Modelo `cashRegister.ts` + `src/services/cashRegisterService.ts` (AsyncStorage): `getOpenRegister` y `openRegister(efectivo inicial en centavos)`.
- [x] **Regla "no ventas sin caja abierta"**: la pestaña **Inicio** revisa al enfocar si hay caja abierta; si no, muestra la pantalla **"Abrir caja"** (efectivo inicial, validado). Al abrirla, Inicio muestra la caja activa.
- [x] Pestaña **Más**: tarjeta del negocio (de la configuración) + tarjeta de **Caja** (abierta desde HH:mm + monto inicial, o cerrada).
- [x] `parseMoney` en `money.ts` (texto → centavos, con 0–2 decimales y coma/punto) y `formatTime` en `datetime.ts`.
- [x] Tests: parseMoney + formatTime (24 tests en total, pasando).

### Hecho (Fase 7)

- [x] Modelo `product.ts` + repositorio con **abstracción** (`src/repositories/productRepository.ts`): implementación en memoria con **catálogo de prueba** (comidas, bebidas, postres). SQLite lo reemplazará en la Fase 11 sin tocar pantallas.
- [x] `src/contexts/CartContext.tsx` (carrito compartido entre pantallas) + utilidades puras en `src/utils/cart.ts` (agregar, subtotal, conteo).
- [x] Pantalla de **Facturación** en Inicio (con caja abierta): buscador de productos, chips de categorías, grid 2 columnas, botón **+** para agregar, barra inferior con cuenta + subtotal.
- [x] Tests: `cart.ts` (29 tests en total, pasando).

### Hecho (Fase 8)

- [x] Carrito editable en `src/screens/cart/CartScreen.tsx` (pantalla arriba de las pestañas): filas con emoji, precio unitario, stepper **− / cantidad / +**, total por línea y **eliminar** (ícono basura).
- [x] Barra inferior de facturación ahora es botón → abre el carrito.
- [x] Panel plegable **"Datos del cliente (opcional)"**: nombre y apellido, teléfono, dirección y descripción (multilínea), guardados en el contexto del carrito para la Fase 9.
- [x] `TextField` soporta multilínea.
- [x] Tests: increase/decrease/remove/clear del carrito (33 tests en total, pasando).

### Hecho (Fase 9)

- [x] Modelo `order.ts` (estado `pending`/`paid`, método de pago, cliente, recibido/cambio) + `src/utils/order.ts` (`buildOrder`).
- [x] Repositorio de órdenes con **abstracción** (`src/repositories/orderRepository.ts`): en memoria, números consecutivos, separa pendientes/pagadas.
- [x] **"Cobrar" o "Guardar orden"** en `PaymentScreen`: guardar deja la orden pendiente y limpia el carrito (aviso "Orden guardada").
- [x] **Cobrar** → `PaymentMethodScreen`: efectivo (con chips rápidos RD$100/200/500/1000, "Exacto" y **cambio automático**) o transferencia.
- [x] **"Venta completada"** (`OrderCompleteScreen`): resumen con método, recibido, cambio y total.
- [x] **Horas en formato a.m./p.m.** (`datetime.ts`): ej. "8:43 a.m.", "6:09 p.m.".
- [x] Tests: buildOrder + repositorio (42 tests en total, pasando).

### Hecho (Fase 10)

- [x] Modelo `product.ts` ampliado: `imageType` (`emoji`/`icon`/`photo`), `emoji`, `icon` (Ionicons), `imageUri`, `trackStock` y `stockQuantity`.
- [x] Repositorio de productos con **CRUD** (`create`, `update`, `remove`) y `decreaseStock` (nunca pasa de 0). Catálogo de prueba ahora con stock (hamburguesa 50, sándwich 20, refresco 100, helado 30).
- [x] **Editar/crear productos** (`ProductFormScreen`): nombre, precio RD$, categoría (con chips de las existentes), activo/inactivo, imagen con 3 fuentes (emoji, ícono de la librería, foto de galería vía `expo-image-picker`) y stock opcional (switch + cantidad). Validado con mensajes claros.
- [x] **Lista de productos** (`ProductsScreen`): filas con imagen, precio y stock; los inactivos se atenúan y se ocultan de la facturación.
- [x] **Stock funcional en la venta**: al agregar al carrito no supera el stock (aviso "Stock insuficiente"), tarjetas muestran "Agotado"/"Quedan N" (rojo/amarillo cuando queda poco) y **se descuentan las existencias al cobrar** (efectivo o transferencia).
- [x] Imagen del producto usada en facturación, carrito y lista (`ProductImage` con foto recortada circular/cuadrada).
- [x] **Globito rojo de órdenes pendientes**: pestaña Ventas muestra el conteo con badge rojo (`tabBarBadge`) que se refresca al navegar; su lista **"Órdenes guardadas"** ya muestra nº de orden, hora, cliente y total (editar/cobrar/eliminar/búsqueda en Fase 12).
- [x] `PendingOrdersContext` centraliza el conteo de pendientes.
- [x] Dependencia nueva: `expo-image-picker@~57.0.19` (oficial Expo; galería en Android/iOS/Expo Go y web, sin permisos extra en navegador).
- [x] Tests: validateProduct + productRepository + stock (53 tests en total, pasando).

### Ajuste (después de la Fase 10)

- [x] **Cantidad manual en la tarjeta de producto**: cada producto de la facturación tiene un recuadro de cantidad con valor **1 por defecto**; el botón **+** agrega esa cantidad al carrito y se puede cambiar escribiendo antes de sumar. `parseCartQuantity` interpreta el texto.
- [x] **Carrito**: los botones **− cantidad +** ahora son más grandes y están más separados (área de toque 42px, contenedor con espaciado) para evitar toques por error. Además, la cantidad ahora también es **editable manualmente** (campo de texto numérico) en cada línea, además de los steppers.
- [x] Tests: 54 pasando.

### Ajuste posterior a la Fase 12

- [x] **Carrito**: la cantidad de cada línea es editable directamente (input numérico bajo los steppers −/+); al perder el foco se cierra el teclado. Añadido `updateQuantity` en el contexto y `updateItemQuantity` en `cart.ts`.

### Hecho (Fase 11)

- [x] **SQLite** con `expo-sqlite@~57.0.3` (android/ios/Expo Go, sin configuración extra): BD `micaja.db` con tablas `products`, `orders` y `order_meta` (números consecutivos), índices por estado y fecha, `PRAGMA journal_mode = WAL` y **migración automática** (crea tablas y siembra el catálogo si la BD está vacía).
- [x] **Repositorios con dos implementaciones**: `createSqliteProductRepository` / `createSqliteOrderRepository` (SQLite) y las de **en memoria** (web). Los singletons `productRepository` y `orderRepository` son **fachadas perezosas**: en Android/iOS abren SQLite; en el navegador siguen en memoria. Las pantallas no cambian.
- [x] Datos de ventas/stock ya **persisten entre reinicios** en el teléfono (productos creados, stock, órdenes guardadas y pagadas). Web sigue siendo por sesión (opción acordada).
- [x] La capa SQLite vive en archivos `.native.ts` (+ stubs `.ts`): **`expo-sqlite` jamás entra al bundle web** (verificado grepeando el export).
- [x] Config/sesión/negocio siguen en AsyncStorage (decisión acordada: solo ventas/stock en SQLite).
- [x] Se movió el catálogo de prueba a `src/data/seedProducts.ts` (compartido por memoria y SQLite).
- [x] Tests: 54 pasando. Dependencia nueva justificada: `expo-sqlite`.

### Hecho (Fase 12)

- [x] **Órdenes guardadas funcionales** (`SalesScreen`): lista de pendientes con buscador de texto libre que coincide con nº de orden, nombre, teléfono, dirección, descripción, productos, fecha y hora (sin tildes/búsqueda normalizada en `src/utils/orderSearch.ts`). Tocar una orden abre el detalle.
- [x] Pantalla `OrderDetailScreen` (navegación): muestra nº, fecha/hora, datos del cliente, líneas de productos (nombre, cantidad × precio, subtotal) y total; botones **Cobrar orden**, **Editar carrito** (restaura productos + cliente en el carrito, elimina la orden pendiente y abre el carrito) y **Eliminar orden** (con confirmación).
- [x] **Cobrar una orden guardada** (`PaymentMethodScreen`): acepta opcionalmente `orderId`; si viene de una orden guardada, cobra esa orden preservando su número (se marca `paid`, se descuenta stock y se abre `OrderComplete`); si es nuevo, usa el carrito como antes.
- [x] **Ajuste cantidades en facturación**: en la tarjeta de producto de `InvoiceScreen` siempre hay un recuadro de **cantidad editable** (1 por defecto) + botón **+** para sumar esa cantidad al carrito. Al agregar, la cantidad vuelve a 1.
- [x] **Teclado**: en `InvoiceScreen`, toca fuera del campo para cerrar el teclado (`TouchableWithoutFeedback` + `Keyboard.dismiss`, `keyboardDismissMode="on-drag"` en la lista).
- [x] **Pago**: `PaymentScreen` añade los botones **Modificar orden** (vuelve al carrito) y **Cancelar orden** (Alert de confirmación → vacía carrito y vuelve al inicio).
- [x] Tests nuevos: `orderSearch.test.ts` (11 tests). Total: **63 tests pasando**. Nueva carpeta `src/screens/orderDetail/`.

### Hecho (Fase 13)

- [x] **Historial de ventas pagadas** (`HistoryScreen`): nueva 5.ª pestaña **Historial** que lista las ventas cobradas con nº de orden, cliente, hora y total, con buscador de texto libre (reutiliza `filterOrders`).
- [x] Tocar una venta abre `OrderDetailScreen` (reutilizado) para ver su detalle completo. Solo se muestran ventas **pagadas**.
- [x] Se añadió `History: undefined` a `TabParamList` y se conectó en `BottomTabs` con el ícono `time`.
- [x] Tests: 63 pasando (pantalla de UI, sin tests nuevos).

### Hecho (Fase 14)

- [x] **Resumen del día y cierre de caja** (`CashClosureScreen`): desde la pestaña **Más** → botón "Resumen del día y cierre" en la tarjeta de Caja (solo con caja abierta).
- [x] **Lógica pura y testeable** en `src/utils/cashClosure.ts`: `computeCashTotals` (total vendido, efectivo, cambio devuelto, transferencia), `calcCashClosure` (efectivo esperado = inicial + ventas en efectivo − cambio) y `isOrderInRegister` (solo órdenes pagadas dentro del turno, por `paidAt`).
- [x] **Conteo del efectivo**: campo "Efectivo contado" precargado con el esperado; la **diferencia** se calcula en vivo (verde si cuadra, rojo si falta, ámbar si sobra) reutilizando `calcDifference`.
- [x] **Cierre de caja**: `closeRegister` en `src/services/cashRegisterService.ts` guarda el registro del cierre (inicial, esperado, contado, diferencia) en AsyncStorage y elimina la caja abierta; al volver, Inicio pide abrir caja de nuevo.
- [x] Tests nuevos: `cashClosure.test.ts` (10 tests). Total: **75 tests pasando**.

### Hecho (Fase 15)

- [x] **`PrinterService`** en `src/services/printerService.ts`: interfaz (`available`, `label`, `print`) con implementación **inactiva** (`createInactivePrinterService`) que devuelve "Impresión aún no disponible". Singleton `printerService` listo para que en el futuro se conecte a impresión térmica/Bluetooth sin tocar pantallas.
- [x] **`buildTicket`**: convierte una `Order` + nombre del negocio en un ticket imprimible (negocio, nº, fecha de pago, cliente, líneas con cantidad y precio, total, método, recibido y cambio). Puro y testeable.
- [x] **Hook inactivo `usePrinter`** en `src/hooks/usePrinter.ts`: expone `available`, `statusLabel` y `printOrder(order, businessName)`. Aún **no está conectado a ninguna pantalla** (sin imprimir todavía, como acordado).
- [x] Tests nuevos: `printer.test.ts` (6 tests). Total: **81 tests pasando**.

### Hecho (Fases 16–22, resumen)

- [x] **Fase 16:** fixes críticos de facturación (scroll) y stock atómico.
- [x] **Fase 17:** stock siempre activo, renombrar categorías y ajuste rápido de precio/stock desde la lista.
- [x] **Fase 18:** pestaña **Ventas** unificada: segmentos **Guardadas** (con borrado múltiple por selección + conteo en badge) y **Cobradas** (con rango de fechas Desde/Hasta) y ticket para órdenes pendientes.
- [x] **Fase 19:** formato exacto de ticket con datos del negocio, logo base64 y vista previa imprimible en `OrderComplete` y `OrderDetail`.
- [x] **Fase 20:** cierre de caja sin cambio devuelto + recibo de cierre imprimible.
- [x] **Fase 21:** configuración/edición del negocio y del usuario desde la pestaña **Más**.
- [x] **Fase 22:** formato al perder el foco en montos (`RD$1,500.00`) y teléfonos (`809-000-0000`). Ajustes posteriores: cobrar con formato RD$, carrito limpio al facturar y teclado con "Listo". Marca **Vendelo App** con logo.

### Hecho (Fase 23)

- [x] **Código único de factura `FAC-NNNN`**: cada orden obtiene su código a partir de un nº consecutivo global (nunca se reutiliza, nunca `-0000`). Se muestra en "Venta completada", en el detalle y en el ticket impreso.
- [x] **Ticket**: las facturas pagadas imprimen `Factura FAC-0007` y conservan datos del cliente (Tel/Dirección/Nota) si existen.

### Hecho (Fase 24)

- [x] **Directorio de clientes**: nueva pantalla **Clientes** desde **Más → Clientes** (sección CLIENTES) para agregar/editar/eliminar clientes (nombre, teléfono, dirección, nota). Tabla `customers` en SQLite + repositorio con abstracción (memoria para web).
- [x] Buscador de productos por nombre o teléfono en la lista de clientes.

### Hecho (Fase 25)

- [x] **Teclado numérico estricto**: montos (recibido, contado, apertura, precio) aceptan solo dígitos y `.`/`,`; stock y cantidades solo dígitos; teléfonos solo números y `()-espacio` (`sanitize` aplica solo al teclear, no al formatear).
- [x] **Editar montos sin borrar**: al enfocar un campo con formato tipo `RD$1,500.00` se selecciona todo el texto; escribir reemplaza y al salir se vuelve a formatear.
- [x] **Más códigos de factura**: tras `FAC-9999` las siglas varían en base 26 (`FAD-0001` … `FAZ-9999` → `FBA-0001` …), garantizando códigos únicos por mucho tiempo (tests de unicidad con límites exactos).

### Hecho (Fase 26)

- [x] **Stock en órdenes pendientes**: al **Guardar orden** se descuenta el stock (igual que al cobrar); al **cancelar/eliminar/editar** una pendiente el stock **se devuelve**. Cobrar una pendiente **no** descuenta dos veces. Nueva utilidad `src/services/stockService.ts` (`reserveOrderStock`/`releaseOrderStock`) + tests.
- [x] **Código de factura en pendientes**: las órdenes pendientes muestran `Factura FAC-XXXX (Pendiente)` en el detalle y el ticket, con el **mismo formato** que las pagadas; las filas de Ventas y las pagadas muestran el código.
- [x] **Búsqueda por código**: en Ventas se puede buscar por **nombre y apellido**, **código `FAC-…`** y **teléfono** (`orderSearch` incluye ahora el código de factura).
- [x] **Guardado de clientes desde facturación**: se eliminó el panel "Usar cliente guardado" del carrito. Ahora, mientras se escribe el nombre o teléfono aparecen **sugerencias** de clientes guardados (tocarlas rellena los datos) y un botón chico **Guardar cliente** guarda lo escrito en el directorio (se administra en Más → Clientes).
- [x] **Android safe-area**: `Screen` respeta ahora la barra de navegación del teléfono (`edges` incluye `bottom`), evitando que los botones inferiores queden cortados.

### Hecho (Fase 27)

- [x] **Proveedores**: directorio CRUD igual que Clientes (nombre*, teléfono, dirección y nota) en **Más → PROVEEDORES → Directorio de proveedores**. Tabla `providers` en SQLite + repositorio con abstracción (`providerRepository.ts`, memoria para web) y tests nuevos (`providerRepository.test.ts`). Total: **153 tests, 19 suites, pasando**.
- [x] **Proveedor en productos**: `ProductFormScreen` tiene la sección **PROVEEDOR (OPCIONAL)** con nombre + teléfono, sugerencias de proveedores guardados mientras escribes (tocarlas rellena los campos) y botón **Guardar proveedor** que lo agrega al directorio al vuelo. Persistido en SQLite (columnas `provider`/`providerPhone`, migradas automáticamente si faltan).
- [x] **UI adaptativa (detalle safe-area)**: `Screen` hace el borde inferior **solo en Android** (evita que la barra de navegación corte los botones). En iOS/web el sistema ya respeta el gesto home/tab bar, así que se eliminó el borde extra que **dejaba una barra vacía** en iOS.
- [x] **UI adaptativa (dispositivos anchos)**: `Screen` centra el contenido en una columna con **ancho máximo de 560** en tablet/web; en teléfonos se mantiene a pantalla completa. Los formularios de Clientes y Proveedores ahora son **scrollables y evitan el teclado** (`KeyboardAvoidingView` + `ScrollView`).

### Hecho (Fase 28)

- [x] **Impresora configurable desde Más → Impresora** (`PrinterConfigScreen`): interruptor para activar/desactivar la impresión, estado en vivo (activa/conectando/sin conexión/apagada), **Buscar impresoras activas**, conectar/desconectar e **imprimir ticket de prueba**. La configuración se persiste y la impresora vuelve a conectar al reiniciar la app.
- [x] **Impresora del sistema / integrada**: transporte `systemPrintTransport` con **`expo-print@~57.0.2`** que abre el diálogo de impresión del sistema (impresoras integradas de terminales POS, AirPrint y `window.print` en web). **Funciona hoy en Expo Go**.
- [x] **Impresora Bluetooth (BLE 58 mm) implementada**: transporte `bluetoothTransport` sobre un puente BLE nuevo (`bleBridge.native.ts`) con **`react-native-ble-plx`**: escaneo de térmicas BLE, conexión, detección automática del canal de escritura (servicio/characteristic) y envío de los bytes ESC/POS por fragmentos. Requiere **app compilada** (dev build / EAS), no Expo Go — la dependencia y el plugin de Expo (`app.json` → permisos Bluetooth) quedan configurados. Si además existe un módulo nativo propio `BluetoothPrinterBridge`, se usa primero. El generador **ESC/POS** (`escpos.ts`) ya produce los bytes para la térmica (inicialización, texto UTF-8, avance y corte).
- [x] **Impresora de prueba simulada**: `demoPrintTransport` permite recorrer todo el flujo (buscar → conectar → imprimir) sin hardware.
- [x] **Botones de imprimir donde corresponde**: solo aparecen cuando hay una impresora activa (condición `ready`) — en **Venta completada** (tras cobrar), en el **detalle de la venta** y dentro de los **modales de ticket y recibo de cierre**.
- [x] **Auto-reconexión**: si la impresora configurada se apagó y vuelve a encender (o se pierde el enlace), el servicio se reconecta solo: al volver la app a primer plano, con un verificador periódico (15 s) y antes de cada impresión. Todo idempotente vía `ensureConnected`.
- [x] **Servicio reactivo**: `usePrinter` ahora se suscribe al estado del servicio; la fila **Impresora** en **Más** muestra el estado en vivo y su subtítulo.
- [x] Tests nuevos (`printerFlow.test.ts`): generador ESC/POS (bytes), flujo conectar/imprimir/desconectar, reconexión y persistencia de la configuración. Total: **163 tests, 20 suites, pasando**. Dependencia nueva justificada: `expo-print`.

### Hecho (Fase 29)

- [x] **Impresión rápida desde Ventas**: en la pestaña Ventas, cada orden (pendiente o cobrada) tiene un botón de imprimir que envía el ticket directo si hay impresora activa o abre el preview del ticket si no; las pendientes siempre muestran `PENDIENTE` y el aviso `*** PAGO PENDIENTE ***`, y las cobradas muestran `Pagada`.
- [x] **Soporte tablet mejorado**: `Screen` usa ancho máximo de **840** cuando el ancho es ≥720dp (560 en teléfono); la pantalla de facturación muestra **3 columnas** en tablets y **4** en pantallas anchas (2 en teléfono).
- [x] **Respaldo/restore offline**: desde **Más → Datos y respaldo** se exporta un JSON (negocio, usuario, caja, cierres, impresora, productos, pedidos, clientes, proveedores) vía hoja de sistema y se restaura importándolo; se advierte que el archivo es tan sensible como la contraseña.
- [x] **Borrar cuenta**: desde **Más → Datos y respaldo** se eliminan todos los datos locales (storage + SQLite) y se vuelve a la pantalla de setup.
- [x] `expo-file-system@~57.0.7`, `expo-sharing@~57.0.21`, `expo-document-picker@~57.0.2` instaladas para la operación. Total: **171 tests, 21 suites, pasando**.

## Lo que falta
**El MVP está completo.** Con la Fase 28 ya se imprime por el sistema/integrada y la impresora térmica Bluetooth (BLE) quedó implementada (react-native-ble-plx en una app compilada; en Expo Go usa la impresión por sistema), la Fase 29 añadió impresión rápida desde Ventas, soporte tablet, respaldo/restore offline por archivo y borrado de cuenta, la Fase 31 dejó Google Drive fuera de la vista (el servicio queda listo para retomar el respaldo en nube en una próxima versión) y la Fase 32 dejó las pantallas de formulario listas para iPad/tablet (columna centrada 560dp). Con **F3/F3.1** quedó implementado y auditado el **backend ASP.NET Core + PostgreSQL** (Source of Truth) — ver la sección **Backend** más abajo. Lo siguiente en la lista de "Posteriores" puede retomarse cualquier día: sincronización cliente↔servidor (F5.1), sincronización multi-dispositivo (F6), múltiples cajas/sucursales, códigos de barras, facturación electrónica (DGII/NCF) y el respaldo en la nube. Con **F4** quedó completada la **autenticación server** (logout, cambio de contraseña con revocación por `changeEpoch`, `/auth/me`, reuso de refresh = 409 y rate limiting en login/registro/refresh) y con **F4.1** la **auditoría de seguridad** (IDOR, permisos, aislamiento multi-negocio, rate-limit en sync/backups, tokens y logs) — ver `docs/INFORME-F4.md` y `docs/INFORME-F4-1.md`.

## Cómo correr la app

```bash
cd "C:\Users\raphy\OneDrive\Documentos\PROYECTOS\MI-NEGOCIO-APP"
npm run web           # previsualizar en Chrome (F12 → modo celular)
npm start             # QR para probar en Android con Expo Go (mismo WiFi)
npm run android       # intenta abrir en Android (si hay emulador/dispositivo conectado)
```

- En el **navegador**: expone la app a tamaño móvil.
- En el **teléfono**: instalar **Expo Go** (Google Play) y escanear el QR de `npm start`.

## Backend (F3 / F3.1 / F4 / F4.1)

Servidor API **Source of Truth** del historial: ASP.NET Core Minimal API (net10.0) + EF Core 10 + PostgreSQL 17 (SQLite en tests).

```bash
cd backend
dotnet restore
dotnet run --project src/Vendelo.Api      # Development → http://localhost:5243 (OpenAPI en /openapi/v1.json)
dotnet test Vendelo.slnx                  # 44/44 tests de integración
dotnet ef migrations add <Name>           # genera migración Npgsql (Database__Provider=Npgsql)
```

- Proveedor/config por env: `Database:Provider` (Npgsql | Sqlite), `ConnectionStrings:Vendelo`, `Jwt__Key`. En Development hay clave JWT local de respaldo (SIN uso en producción).
- Estructura: `backend/src/Vendelo.Api/{Endpoints, Data, Auth, Common}` + `backend/tests/Vendelo.Api.Tests`.
- Contratos y decisiones: `docs/API-CONTRACT.md`, `docs/BACKEND-F3-CONTRACT.md`; cierres de fase: `docs/INFORME-F3.md`, `docs/INFORME-F3-1.md`, `docs/INFORME-F4.md`, `docs/INFORME-F4-1.md`.

## Decisiones técnicas ya acordadas (no cambiar sin discusión)

1. **Dinero = entero en centavos** (`number`). Nunca flotantes para montos. Formateo centralizado en `money.ts`.
2. **Offline-first:** SQLite local en Android/iOS. Sin backend, sin nube, sin autenticación online en el MVP.
3. **BD abstracta por repositorios**: SQLite en celular, implementación en memoria para navegador (opción A acordada). Las pantallas no saben cuál es.
4. **Contraseñas con hash** (SHA-256 + sal) vía `expo-crypto`. Nunca texto plano.
5. **Sin librerías innecesarias**: navegación con `@react-navigation`, estado con hooks/Context (sin Redux), estilos con `StyleSheet`/tema propio (sin UI kits). Siempre pedir permiso antes de agregar dependencia.
6. **Moneda: RD$** (pesos dominicanos).
7. **Cada fase = un commit descriptivo.** No mezclar fases. Verificar con `tsc` + `jest` antes de commit.
8. **Regla de no inventar:** si se encuentra una mejora, se propone y se espera autorización. No implementar por cuenta propia.
9. **Stock según estado de la orden:** guardar una orden pendiente descuenta stock; cobrarla no descuenta de nuevo; cancelarla/eliminarla/volverla a editar lo devuelve.
10. **Backend = Source of Truth (F3):** ASP.NET Core Minimal API + EF Core 10 + PostgreSQL (SQLite en tests), contrato en `docs/API-CONTRACT.md`; el cliente sigue siendo offline-first (SQLite local primario) y el backend arbitra roles, capacidades (`FEATURE_DISABLED`), secuencia y dedupe de sync.

## Posteriores (fuera de alcance del MVP)

Conectar la app al backend (F5.1), despliegue y migraciones PostgreSQL (F5), sincronización multi-dispositivo (F6), múltiples cajas/sucursales, códigos de barras, facturación electrónica (DGII/NCF), inventario real, exportación/backup en nube.

## Notas de entorno / problemas conocidos

- **npm 11.19+ bloquea el flag `--allow-scripts`** que Expo CLI usa internamente → `npx expo install` falla con `EALLOWSCRIPTS`.
  - **Solución adoptada:** instalar dependencias con `npm install <paquete>@<version>` directo, con las versiones que já conoce Expo. Para Expo SDK 57, consultar `node_modules/expo/bundledNativeModules.json`.
  - No agregar `allowScripts` a `package.json`: no resuelve el problema (probado).
- **Encoding:** no escribir `package.json` (ni ningún .json de Expo) con BOM (UTF-8 con marca) — Expo falla al parsearlo (`Unexpected token`). Salidas de PowerShell con `Set-Content -Encoding UTF8` y algunos editores añaden BOM. Verificar primer byte (debe ser `{` = 123, no 239).
- **`.git`** fue inicializado por `create-expo-app` automáticamente; se renombró la rama a `main`.
- **Web export roto en la versión actual de `expo-sqlite` (~57.0.3)**: `npx expo export --platform web` falla con `Unable to resolve module ./wa-sqlite/wa-sqlite.wasm` (la carpeta `web/wa-sqlite` del paquete no se resuelve desde `build/` en Metro). No depende del código de la app y no afecta Android/iOS ni Expo Go; pendiente de arreglo/upstream.
- **JSX requiere `.tsx`**: un archivo `.ts` con JSX (como el Provider del theme) falla en typecheck.
- En `tsconfig.json` se declaró `"types": ["jest"]` para que la base de Expo reconozca `describe/it/expect`.
- Estructura del proyecto (Fases 2+):

```
backend/          # F3: API ASP.NET Core (Endpoints/, Data/, Auth/, Common/) + tests
docs/             # API-CONTRACT, BACKEND-F3-CONTRACT, INFORME-F3, INFORME-F3-1, auditorías F2
src/
  models/          # business, user, product, order, cashRegister, customer, provider
  screens/         # setup, login, cashRegister(cash), invoicing, cart, payment, orderDetail, sales, products, settings, customers, providers
  navigation/      # stack + tabs
  components/      # ProductCard, CartItem, MoneyDisplay, PrimaryButton, Column (columna 560dp), CalendarModal...
  services/        # database, repositories, auth (setupService), session (cashRegisterService), stock (stockService), printer (printerService + carpeta printer/), backup (backupService.ts)
  hooks/           # usePrinter (reactivo al estado de la impresora), useCart
  theme/           # colors, typography, spacing, componentes
  utils/           # backup.ts (serializar/parsear respaldo), money.ts (formato + cálculo centavos), orderSearch.ts, cashClosure.ts, invoice.ts
  models/          # product, order, customer, provider, business, user, cashRegister
 __tests__/         # tests de dinero, carrito, buildOrder, repositorios (incl. customer/provider), validaciones, orderSearch, cashClosure, printer, flujo de impresión y backup
```

## Registro de commits

- `4ba6a7f` F4: autenticación server completada (logout, change-password con revocación por `changeEpoch`, `/auth/me`, reuso de refresh = 409, rate-limit 429 + Retry-After) — 36/36 tests backend

- `a2f27ac` F3 + F3.1: backend ASP.NET Core Source of Truth (auth, negocios, dispositivos, catálogo, órdenes, inventario, caja, sync pull/push, backups) con contrato `API-CONTRACT`, auditoría F3.1 e informes (`INFORME-F3`/`INFORME-F3-1`); rename slug a vendelo-app; README y `.gitignore` actualizados — 27/27 tests backend, 298 tests cliente

- `a6d0ebf` FASE 1: preparación SQLite para sync (updatedAt/deletedAt, tombstones, ledger `stock_movements`, `sync_state` + deviceId, backups retrocompatibles y transacciones atómicas) con auditoría F1.1 — 298 tests pasando

- `d32e79e` Fases 0-19: auditoría técnica y endurecimiento del núcleo financiero
- `f1fd4b0` Fase 33: transacciones atómicas e idempotencia de pago/anulación — conTransaction inyectable (SQLite real + passthrough web/tests), cobrar/anular/cancelar dentro de la misma transacción (nunca a medias), stock devuelto en la misma transacción al anular, doble-toque bloqueado al cobrar y 203 tests pasando (24 suites, 18 de ellos en orderService)

- `34193d1` Fase 32: datos del cliente a pantalla completa con Continuar, columna 560dp centrada (Column) para las pantallas de formulario en iPad/tablet y calendario de Ventas renovado (rango por campo, automático y con bug de llaves duplicadas corregido)
- `9750f2c` Pestana Mas limpia: esencial (negocio, caja, tema, cerrar sesion) y pantalla Configuracion aparte
- `2188426` Fase 31: ajustes detallados - pie del carrito fijo, logo y mensaje del ticket en Mi negocio, Drive fuera de la vista (sin sync al cerrar), cierre de caja con total contado, app bloqueada con caja cerrada (solo inventario) y Ventas sin rango de fechas
- `ebfa324` Fase 30: sincronizacion Google Drive - upload auto post-cierre, cola offline, restore manual Drive
- `c5ff29f` Fase 29: impresion rapida en Ventas (pendientes y cobradas), tablet responsive (840dp y grilla 3-4 col), backup/restore por archivo JSON y borrar cuenta/datos
- `3e64b3c` Fase 28: impresora configurable (sistema/integrada, Bluetooth y demo) con auto-reconexion, botones de impresion y tickets ESC/POS
- `5931004` Fase 27: proveedores como clientes (directorio, SQLite y proveedor en productos) y UI adaptativa (safe areas por plataforma y ancho maximo centrado)
- `5bf96b9` Fase 26: stock reservado en pendientes con devolucion al cancelar, codigo FAC visible y buscable, guardar clientes desde facturacion y safe-area Android
- `6287213` Fase 25: teclado numerico estricto, edicion de montos sin borrar y mas codigos de factura
- `1682ad2` Fase 24: directorio de clientes
- `07a6d56` Cierre de caja: confirmar diferencia y parseo robusto del contado
- `d67e27c` Fase 23: codigo unico de factura FAC-NNNN
- `17c37fb` Arreglos: cobrar con formato RD$, cliente limpio y teclado con 'Listo'
- `3280061` Vendelo App: nombre y logo
- `25fc2fe` Fase 22: formato al perder el foco en montos y telefonos (B7)
- `1c02977` Fase 21: configuracion en la pestana Mas (B5)
- `344c29d` Fase 20: cierre de caja sin cambio devuelto + recibo de cierre imprimible
- `c3e0567` Fase 19: formato exacto de ticket con datos del negocio, logo base64 y vista previa (OrderComplete + OrderDetail)
- `b8986f7` Fase 18: pestana Ventas unificada - guardadas (borrado multiple) y cobradas (rango de fechas) + ticket pendiente
- `f1e947b` Fase 17: stock siempre activo, renombrar categorias y ajuste rapido de precio/stock
- `dda36fb` Fase 16: fixes criticos - scroll de facturacion y stock atomico (tope en carrito y revalidacion al cobrar)
- `94b7659` Actualizar registro de commits en README
- `93230bf` Fase 15: abstraccion PrinterService y hook inactivo usePrinter
- `a09748f` Fase 14: resumen del día y cierre de caja (efectivo esperado vs contado)
- `97f3dc8` Ajustes: proveedor por producto, eliminar categoría y corregir test de repositorio
- `1cc6d55` Ajuste: editar cantidades en carrito + Fase 13 (historial de ventas pagadas)
- `d6de140` Fase 12: ordenes guardadas funcionales (detalle, cobrar, editar, eliminar, busqueda) + ajustes de cantidades/teclado/botones pago
- `0bbebf3` Actualizar README con la Fase 11
- `2f0ea8c` SQLite con expo-sqlite y repositorios con abstracción web en memoria
- `ef13374` Cantidad manual por producto y steppers del carrito más separados
- `044e041` Actualizar README con la Fase 10
- `d49bebf` Productos CRUD con stock, imagen y globito de órdenes pendientes
- `1f32b19` Actualizar README con Fase 9
- `5b7e38f` Agregar pago y guardar orden con hora a.m./p.m.
- `dfec0f7` Actualizar README con Fase 8
- `46ed043` Agregar carrito completo y datos del cliente
- `398c8e2` Actualizar README con Fase 7
- `e4d554e` Agregar facturación con buscador y catálogo de prueba
- `658cd7d` Actualizar README con Fase 6
- `78c3e16` Agregar apertura de caja
- `9776bb2` Actualizar README con Fase 5
- `3a62ce9` Agregar login local