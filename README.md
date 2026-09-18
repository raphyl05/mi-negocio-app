# MiCaja 🧾

Aplicación móvil de facturación/POS sencilla para pequeños negocios de comida rápida y vendedores ambulantes.
React Native + Expo + TypeScript. Funciona 100% offline (MVP).

---

## Estado actual

**Fase 1 COMPLETADA ✅** — proyecto creado, web habilitado, tipo de app configurado, repositorio conectado.
**Fase 2 COMPLETADA ✅** — sistema visual (tema turquesa/cian) + utilidad de dinero RD$ + tests.
**Fase 3 COMPLETADA ✅** — navegación: stack raíz + 4 pestañas (Inicio, Ventas, Productos, Más).

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

## Lo que falta (Fases 4–15)

Cada fase queda **funcional por sí sola** y la siguiente solo se conecta a la anterior.

| Fase | Qué falta hacer | Verificación |
|---|---|---|
| 4 | Configuración inicial del negocio (nombre, usuario, contraseña → hash) | formulario + validaciones |
| 5 | Login local (verificar usuario + hash) | tests de autenticación |
| 6 | Apertura de caja | regla "no ventas sin caja abierta" |
| 7 | Facturación: buscador, categorías (chips), grid 2–3 col, agregar al carrito | flujo manual |
| 8 | Carrito completo (+/−, eliminar) | tests de subtotal |
| 9 | Pago efectivo/transferencia, cambio automático, "Venta completada" | tests de cambio |
| 10 | Productos CRUD (nombre, precio, categoría, emoji/estado) | formulario + validaciones |
| 11 | SQLite con `expo-sqlite` + repositorios con **abstracción para web en memoria** | funciona en Android y navegador |
| 12 | Guardar ventas transaccional (venta + items) | venta visible en historial |
| 13 | Historial del día + detalle de venta | consultas |
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