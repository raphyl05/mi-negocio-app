# MiCaja 🧾

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

> **IMPORTANTE:** este README es la guía de retorno. Si retomas el proyecto después de tiempo, lee esto antes de escribir código.
> Además, existe `AGENTS.md` en la raíz que indica revisar la documentación de Expo SDK 57:
> https://docs.expo.dev/versions/v57.0.0/

### Hecho (Fase 1)

- [x] Proyecto **Expo SDK 57** + **React Native 0.86** + **TypeScript 6** creado con plantilla `blank-typescript`.
- [x] Nombre de la app: **"MiCaja"** (`app.json`). Slug: `mi-negocio-app`.
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

- [x] **Cantidad manual en la tarjeta de producto**: cada producto de la facturación tiene un recuadro de cantidad; el botón **+** sigue agregando (por defecto 1, o la cantidad escrita, validada contra el stock). `parseCartQuantity` en `src/utils/cart.ts` interpreta el texto.
- [x] **Carrito**: los botones **− cantidad +** ahora son más grandes y están más separados (área de toque 42px, contenedor con espaciado) para evitar toques por error.
- [x] Tests: 54 pasando.

### Hecho (Fase 11)

- [x] **SQLite** con `expo-sqlite@~57.0.3` (android/ios/Expo Go, sin configuración extra): BD `micaja.db` con tablas `products`, `orders` y `order_meta` (números consecutivos), índices por estado y fecha, `PRAGMA journal_mode = WAL` y **migración automática** (crea tablas y siembra el catálogo si la BD está vacía).
- [x] **Repositorios con dos implementaciones**: `createSqliteProductRepository` / `createSqliteOrderRepository` (SQLite) y las de **en memoria** (web). Los singletons `productRepository` y `orderRepository` son **fachadas perezosas**: en Android/iOS abren SQLite; en el navegador siguen en memoria. Las pantallas no cambian.
- [x] Datos de ventas/stock ya **persisten entre reinicios** en el teléfono (productos creados, stock, órdenes guardadas y pagadas). Web sigue siendo por sesión (opción acordada).
- [x] La capa SQLite vive en archivos `.native.ts` (+ stubs `.ts`): **`expo-sqlite` jamás entra al bundle web** (verificado grepeando el export).
- [x] Config/sesión/negocio siguen en AsyncStorage (decisión acordada: solo ventas/stock en SQLite).
- [x] Se movió el catálogo de prueba a `src/data/seedProducts.ts` (compartido por memoria y SQLite).
- [x] Tests: 54 pasando. Dependencia nueva justificada: `expo-sqlite`.

## Lo que falta (Fases 12–15)

Cada fase queda **funcional por sí sola** y la siguiente solo se conecta a la anterior.

| Fase | Qué falta hacer | Verificación |
|---|---|---|
| 12 | Órdenes guardadas: lista de pendientes; abrir = editar carrito / cobrar / eliminar; buscar por fecha, hora y texto libre (nombre, apellido, teléfono, dirección, descripción, n.º de orden) | consultas + tests de búsqueda |
| 13 | Historial de ventas pagadas + detalle + el mismo buscador (fecha, hora, texto libre) | consultas |
| 14 | Resumen del día + cierre de caja (efectivo esperado vs contado) | tests de diferencia |
| 15 | Abstracción `PrinterService` (sin imprimir aún) | hook inactivo presente |

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

## Posteriores (fuera de alcance del MVP)

Backend (ASP.NET Core + PostgreSQL), sincronización multi-dispositivo, múltiples cajas/sucursales, impresión térmica/Bluetooth, códigos de barras, facturación electrónica (DGII/NCF), inventario real, clientes/proveedores, exportación/backup en nube.

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
  models/          # business, user, product, sale, saleItem, cashRegister
  screens/         # setup, login, cashRegister, invoicing, cart, payment, sales, products, settings
  navigation/      # stack + tabs
  components/      # ProductCard, CartItem, MoneyDisplay, PrimaryButton...
  services/        # database, repositories, auth, printer, session
  theme/           # colors, typography, spacing, componentes
  utils/           # money.ts (formato + cálculo centavos)
__tests__/         # tests de la calculadora (subtotal, total, cambio, diferencia)
```

## Registro de commits

- `5fc354d` Initial commit (generado por create-expo-app)
- `ecd9414` Inicializar app con Expo y Git
- `6ed00cf` Corregir encoding de package.json
- `e821eb6` Agregar README con estado y plan del proyecto