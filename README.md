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

> **IMPORTANTE:** este README es la guía de retorno. Si retomas el proyecto después de tiempo, lee esto antes de escribir código.
> Además, existe `AGENTS.md` en la raíz que indica revisar la documentación de Expo SDK 57:
> https://docs.expo.dev/versions/v57.0.0/

### Hecho (Fase 1)

- [x] Proyecto **Expo SDK 57** + **React Native 0.86** + **TypeScript 6** creado con plantilla `blank-typescript`.
- [x] Nombre de la app: **"Vendelo App"** con logo `logo-vendelo-app.png` (`app.json`). Slug: `mi-negocio-app`.
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
- [x] **Impresora Bluetooth (térmica 58 mm) preparada**: transporte `bluetoothTransport` con interfaz `BluetoothPrinterBridge` (puente nativo). Hoy, desde Expo Go, la pantalla explica que falta el módulo nativo; cuando el proyecto tenga un **dev build** con el puente implementado, la impresora se conecta desde la misma pantalla sin tocar el resto del código. El generador **ESC/POS** (`escpos.ts`) ya produce los bytes para la térmica (inicialización, texto UTF-8, avance y corte).
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
**El MVP está completo.** Con la Fase 28 ya se imprime por el sistema/integrada y con la Fase 29 se añadió impresión rápida desde Ventas, soporte tablet optimizado, respaldo/restore offline por archivo y borrado de cuenta. Lo siguiente en la lista de "Posteriores" puede retomarse cualquier día: impresión térmica Bluetooth real (módulo nativo + dev build), códigos de barras, facturación electrónica (DGII/NCF), inventario real, backend (ASP.NET Core + PostgreSQL), sincronización multi-dispositivo, múltiples cajas/sucursales y exportación/backup en nube.

## Cómo correr la app

```bash
cd "C:\Users\raphy\OneDrive\Documentos\PROYECTOS\MI-NEGOCIO-APP"
npm run web           # previsualizar en Chrome (F12 → modo celular)
npm start             # QR para probar en Android con Expo Go (mismo WiFi)
npm run android       # intenta abrir en Android (si hay emulador/dispositivo conectado)
```

- En el **navegador**: expone la app a tamaño móvil.
- En el **teléfono**: instalar **Expo Go** (Google Play) y escanear el QR de `npm start`.

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

## Posteriores (fuera de alcance del MVP)

Backend (ASP.NET Core + PostgreSQL), sincronización multi-dispositivo, múltiples cajas/sucursales, impresión térmica Bluetooth real (módulo nativo / dev build), códigos de barras, facturación electrónica (DGII/NCF), inventario real, exportación/backup en nube.

## Notas de entorno / problemas conocidos

- **npm 11.19+ bloquea el flag `--allow-scripts`** que Expo CLI usa internamente → `npx expo install` falla con `EALLOWSCRIPTS`.
  - **Solución adoptada:** instalar dependencias con `npm install <paquete>@<version>` directo, con las versiones que já conoce Expo. Para Expo SDK 57, consultar `node_modules/expo/bundledNativeModules.json`.
  - No agregar `allowScripts` a `package.json`: no resuelve el problema (probado).
- **Encoding:** no escribir `package.json` (ni ningún .json de Expo) con BOM (UTF-8 con marca) — Expo falla al parsearlo (`Unexpected token`). Salidas de PowerShell con `Set-Content -Encoding UTF8` y algunos editores añaden BOM. Verificar primer byte (debe ser `{` = 123, no 239).
- **`.git`** fue inicializado por `create-expo-app` automáticamente; se renombró la rama a `main`.
- **JSX requiere `.tsx`**: un archivo `.ts` con JSX (como el Provider del theme) falla en typecheck.
- En `tsconfig.json` se declaró `"types": ["jest"]` para que la base de Expo reconozca `describe/it/expect`.
- Estructura del proyecto (Fases 2+):

```
src/
  models/          # business, user, product, order, cashRegister, customer, provider
  screens/         # setup, login, cashRegister(cash), invoicing, cart, payment, orderDetail, sales, products, settings, customers, providers
  navigation/      # stack + tabs
  components/      # ProductCard, CartItem, MoneyDisplay, PrimaryButton...
  services/        # database, repositories, auth (setupService), session (cashRegisterService), stock (stockService), printer (printerService + carpeta printer/), backup (backupService.ts)
  hooks/           # usePrinter (reactivo al estado de la impresora), useCart
  theme/           # colors, typography, spacing, componentes
  utils/           # backup.ts (serializar/parsear respaldo), money.ts (formato + cálculo centavos), orderSearch.ts, cashClosure.ts, invoice.ts
  models/          # product, order, customer, provider, business, user, cashRegister
 __tests__/         # tests de dinero, carrito, buildOrder, repositorios (incl. customer/provider), validaciones, orderSearch, cashClosure, printer, flujo de impresión y backup
```

## Registro de commits

- `c5ff29f` Fase 29: impresion rapida en Ventas (pendientes y cobradas), tablet responsive (840dp y grilla 3-4 col), backup/restore por archivo JSON y borrar cuenta/datos
- `NUEVO` Fase 30: sincronizacion Google Drive - upload auto post-cierre, cola offline, restore manual Drive
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