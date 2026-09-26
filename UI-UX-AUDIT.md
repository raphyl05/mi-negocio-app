# Vendelo App — Auditoría UI/Uxex (Solo lectura)

> **Alcance:** `C:\Users\raphy\OneDrive\Documentos\PROYECTOS\VENDELO-APP`
> **Fecha:** 2026-09-24 · **Modo:** solo lectura. No se modificó ningún archivo.
> **Método:** extracción de cadenas de estilo y rastreo de flujos por archivo + verificación de colores/dimensiones por código. Los hallazgos que requieren hardware (teclado real, imprenta, launcher APK) se marcan explícitamente como **HECHO = código**, **INTERPRETACIÓN = comportamiento probable**, **REQUIERE PRUEBA** cuando no es confirmable por inspección.

---

## 1. Resumen ejecutivo

Vendelo App es una app **local-first POS** bien diseñada a nivel visual: uso sistemático de un token de tema (`useTheme`), `Screen` que limita ancho máximo (720-840px), botones `PrimaryButton` con `minHeight 56` y componentes compartidos (`TextField`, `Card`, `Column`) que mantienen coherencia visual. Los problemas más importantes **no** están en la estética, sino en **robustez para el entorno POS real**: teclado que tapa campos en Android (la mayoría de pantallas pasan `behavior: undefined` en Android por `KeyboardAvoidingView` con condición iOS), campos sin `label` visual permanente en algunos modales, tamaños de texto/contraste bajos en captions, y un **icono/logo de app que no cumple con la zona segura de la máscara de launcher de Android**, lo que explica el problema del APK.

Las prioridades (por impacto técnico/UX):

1. **Teclado Android → `KeyboardAvoidingView` no actúa (iOS-only `behavior`)** — afecta muchos formularios. *Confirmable por inspección; comportamiento exacto requiere prueba en device.*
2. **Icono/adaptive icon fuera de zona segura** — causa probable del logo cortado/pequeño en el APK. *Evidencia de píxeles.*
3. **Logos de negocio en HTML del ticket con `data:image/png` hardcodeado pero base64 puede no ser PNG** — logo de ticket puede no pintarse. *Falta validar en device.*
4. **Contraste deficiente**: texto `textSecondary` (#6C7A89) sobre `surface` y `primary (#00B8A9)` sobre `surface` en chips/captions — tokens de bajo contraste usados sistemáticamente.
5. **`adjustsFontSizeToFit` + `numberOfLines={1}` en botones de dinero** y textos con `fontWeight:600` en rgba contrastes bajos.
6. **Inputs de cantidad dentro de rows de cart son `TextInput` sin sanitizar a integer ni límite de maxLength** — riesgo de basura en cantidades.
7. **Teclado numérico en POS**: dominación de teclados `number-pad` sin `returnKey` para avanzar al siguiente campo (falta `blurOnSubmit`/`onSubmitEditing` en algunos).
8. **Header deshabilitado globalmente** — muchas subpantallas dependen del botón físico back de Android; en POS sin back se pierde navegación.
9. **Assets**: `icon.png` es 1024×1024 llenando todo el canvas (sin área transparente) y el foreground/usa foreground 512×512 sin margen seguro; el background es blanco — el logo queda recortado por la máscara.
10. **Accesibilidad**: falta de mayor respeto de `fontScale` (fontSize en px fijos), toque mínimo <44pt en varios iconos/hitSlop.

---

## 2. Inventario de pantallas

| # | Pantalla | Archivo | Propósito | Scroll | Lista | Modal | Inputs | Teclado | Riesgo UI | Riesgo UX |
|---|----------|---------|-----------|--------|-------|-------|--------|---------|-----------|-----------|
| 1 | Login | `src/screens/login/LoginScreen.tsx` (725ln) | Login / registro / recuperación (3 modos + cloud) | ScrollView (x4) | — | RecoveryForm interno | TextField (compartido) | KAV iOS-only en 2 vistas | Contraste banner; flow branching complejo | 4 modos condensados en 1 pantalla |
| 2 | Home/Dashboard | `src/screens/home/HomeScreen.tsx` (56ln) | Selección Inicio (Ventas/Productos/…) + tarjetas | — | — | — | — | — | — | Depende de `width >= 720` |
| 3 | Facturación/Invoice | `src/screens/home/InvoiceScreen.tsx` (472ln) | Catálogo + carrito | ScrollView horizontal chips + vertical | FlatList (grid 2/3/4 col) | QuickEditModal, VoidReasonModal | TextField cantidad (TextInput) | KAV iOS-only; dismiss on-drag | Padding 24 fijo | Stock error en banner fuera de foco |
| 4 | Cart | `src/screens/cart/CartScreen.tsx` (472ln) | Carrito + cliente/mesero | ScrollView | FlatList | CustomerPanel (modal full) | TextField qty + customer fields (4) | KAV iOS-only (x2) | `keyboardDismissMode on-drag` y texto ícono | Guardar cliente depende de KAV |
| 5 | Payment | `src/screens/payment/PaymentScreen.tsx` (217ln) | Método de pago | ScrollView | — | TicketPreviewModal | TextField efectivo (decimal-pad) | KAV ausente | Cambio/botones cerca de footer | Keyboard cubre total/botón |
| 6 | PaymentMethod | `src/screens/payment/PaymentMethodScreen.tsx` (332ln) | Selector método + transferencia | ScrollView | — | — | TextField | KAV iOS-only | — | Flujo cobro sin verificación |
| 7 | OrderComplete | `src/screens/payment/OrderCompleteScreen.tsx` | Confirmación + ticket | ScrollView | — | TicketPreviewModal | — | — | — | — |
| 8 | OrderDetail | `src/screens/orderDetail/OrderDetailScreen.tsx` | Detalle/anular | ScrollView | — | TicketPreviewModal, VoidReasonModal | — (reason in modal) | KAV en modal | — | — |
| 9 | ProductForm | `src/screens/productForm/ProductFormScreen.tsx` (663ln) | Crear/editar producto | ScrollView | — | QuickEdit (categoría), QuickEditModal | TextField (8+) + image picker | KAV iOS-only; TextField sanitize | Proveedor persist; labels | Formulario largo (stock, precios) |
| 10 | Products | `src/screens/products/ProductsScreen.tsx` | Lista catálogo + quick edit | — | FlatList | QuickEditModal | — | — | stock card | — |
| 11 | Ventas | `src/screens/sales/VentasScreen.tsx` | Guardadas/cobradas | — | FlatList | CalendarModal, TicketPreviewModal | search TextInput | KAV ausente (ScrollView para filtro) | Date range multi-estado | Selección múltiple por long-press |
| 12 | Kitchen | `src/screens/kitchen/KitchenScreen.tsx` (293ln) | Órdenes cocina | — | (map directo sin FlatList) | TicketPreviewModal | — | — | dataset chico mal | Ordenes desordenadas sin scroll |
| 13 | OpenCash | `src/screens/cash/OpenCashScreen.tsx` (129ln) | Apertura de caja | ScrollView | — | — | TextField efectivo | KAV iOS-only | input bottom | Botón puede quedar bajo teclado |
| 14 | CashClosure | `src/screens/cash/CashClosureScreen.tsx` (468ln) | Cierre/recuento denominaciones | ScrollView | — | ReceiptPreviewModal | TextFields denominación (raw TextInput) | **SIN KAV** | inputs raw | Totales largos + teclado |
| 15 | Settings | `src/screens/settings/SettingsScreen.tsx` (203ln) | Más (config/datos/seguridad/dispositivos) | ScrollView | — | ConfirmAlert | — | — | logos | — |
| 16 | BusinessEdit | `src/screens/settings/BusinessEditScreen.tsx` | Editar negocio (logo) | ScrollView | — | ImagePicker | TextField (5) | KAV iOS-only | **logo base64 → PNG hardcode** | Logo de ticket |
| 17 | PrinterConfig | `src/screens/settings/PrinterConfigScreen.tsx` | Impresora BLE test | ScrollView | — (map) | — | — | — | accesibilidad | — |
| 18 | Config/Setup | `src/screens/setup/SetupScreen.tsx` (232ln) | Onboarding (8 campos) | ScrollView | — | — | TextField (8) | KAV iOS-only | — | — |
| 19 | Devices | `src/screens/settings/DevicesScreen.tsx` | Equipos | FlatList | — | — | — | — | — | — |
| 20 | Security | `src/screens/settings/SecurityScreen.tsx` | Seguridad | ScrollView | — | — | TextField (5) | KAV iOS-only | captions | — |
| 21 | Customers | CustomersScreen | Clientes | ScrollView+FlatList | FlatList | — | TextField (4) | KAV iOS-only | — | — |
| 22 | Providers | ProvidersScreen | Proveedores | ScrollView | ScrollView (map) | — | TextField (4) | KAV iOS-only | — | — |
| 23 | DatosYRespaldo | DatosYRespaldoScreen | Backup | ScrollView | — | — | TextField | KAV iOS-only | logo | — |
| 24 | Dashboard | DashboardScreen | Est. ventas | ScrollView | — | CalendarModal | — | — | — | — |
| 25 | BusinessSwitcher | BusinessSwitcherScreen | Cambiar negocio | FlatList | — | — | — | — | — | — |
| 26 | Devices/BLE | … | Impresoras | FlatList | — | — | — | — | accesibilidad | — |

---

## 3. Hallazgos

### 3.1 Assets / icono de la app (problema del APK reportado)

### HECHO (inspección de píxeles + app.json)

- `app.json` define `android.adaptiveIcon` (líneas 40-44) con `foregroundImage: ./assets/android-icon-foreground.png`, `backgroundColor: "#FFFFFF"` y `monochromeImage: ./assets/android-icon-monochrome.png` (no usa backgroundImage; solo color).
- `icon.png` = 1024×1024, **contenido ocupando todo el canvas** (muestreo: contenido no-transparente hasta los bordes, sin margen de seguridad; box de contenido prácticamente 0..1020). Un icon **no adaptativo** de 1024px completo sin `padding` transparente queda **cortado/zoom** por la máscara redonda/ochavada del launcher (Android usa la mascará cuadrada→círculo).
- `android-icon-foreground.png` = 512×512, contenido centrado pero con **indicadores opacos hasta ~144px por arriba y 272px por debajo según muestreo**, es decir que el arte no ocupa el cuadrado seguro central 66% (margen requerido ≈51px de 512). El muestreo muestra que el contenido llega cerca de los bordes (margen <51px en varias zonas) → la máscara lo recorta.
- No existe `assets/adapter`/no hay `icon.png` con padding; el único icon adaptativo usa foreground PNG a 512 que excede la zona segura.
- `android-icon-monochrome.png` = 432×432 con contenido centrado (opaque-from-top 124, 272 bottom) — más cercano a zona segura.

### INTERPRETACIÓN
El launcher de Android (y la tienda) muestra el icon recortado o muy pegado al borde: el logo aparece "cortado" o tan pequeño/peleado que "no se ve bien". Esto coincide con el síntoma reportado ("imagen predeterminada de la aplicación no aparece correctamente"). También `splash-icon.png` (1024) lleno hasta borde — puede cortarse en splash en pantallas con redondeo.

### RECOMENDACIÓN FUTURA
Generar foreground con todo el contenido dentro del círculo central (≈66% del canvas, dejar ≥ ~15% de margen transparente en cada borde), y añadir relleno transparente al `icon.png` de 1024px. Probar en 2-3 launchers (OneUI, MIUI, AOSP) y en la Play Console.

### REQUIERE PRUEBA EN DISPOSITIVO
Sí — el aspecto final depende del launcher; pero la falta de zona segura es confirmable por imagen.

---

### 3.2 Logo del negocio en ticket (impresión)

### HECHO
- `src/services/printerService.ts`: `logoDataUri(logoBase64)` (línea 94-97) construye **siempre** `data:image/png;base64,${logoBase64}` — el MIME está hardcodeado a `png`.
- `BusinessEditScreen.tsx` guarda `logoBase64` desde `expo-image-picker` con `mediaTypes: ['images']` (línea 49), que puede devolver **JPEG** — sin convertir a PNG.

### INTERPRETACIÓN
Si el usuario elige una foto/logo JPEG, `logoDataUri` etiqueta bytes JPEG como `image/png`. Al imprimir, la mayoría de impresoras/drivers aceptan (por contenido), pero el HTML ticket `buildTicket` incrusta el data-URI; ciertos view/servicios de vista previa (`ReceiptPreviewModal`, `TicketPreviewModal`) pueden no renderizar el `<img>` si el tipo declarado no coincide → logo ausente en la vista previa/ticket. También los datos base64 inflados en AsyncStorage para fotos grandes.

### RECOMENDACIÓN FUTURA
Detectar el tipo real (`jpeg`/`png`) o re-encodear a PNG al guardar; o anunciar MIME correcto según contenido.

### REQUIERE PRUEBA EN DISPOSITIVO
Sí — probar logo JPEG y logo PNG en la impresora térmica y en la vista previa.

---

## 4. Problemas de teclado

### Patrón dominante (HECHO)
En la mayoría de pantallas el `KeyboardAvoidingView` solo actúa en iOS:
- `KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}` en: LoginScreen (340, 559…), InvoiceScreen, CartScreen, OpenCashScreen (45), SetupScreen (103), BusinessEditScreen, CustomersScreen, ProvidersScreen, SecurityScreen.
- `CashClosureScreen.tsx` **no importa KeyboardAvoidingView** (libre de KAV); solo `ScrollView` y `keyboardShouldPersistTaps="handled"` (línea 184, 149-153).
- `PaymentScreen.tsx` usa `Screen` + `ScrollView` con `keyboardShouldPersistTaps` pero **sin KAV**.

### INTERPRETACIÓN (confirmada en código; requiere device para corroborar comportamiento)
En **Android**, `behavior` no se aplica. La app depende de la resolución de teclado que haga la ventana (Expo/RN por defecto en Android suele `adjustResize` si el `AndroidManifest` no lo cambia; en Expo SDK el `setAdjustResize` suele estar). Sin embargo, en pantallas donde hay **ScrollView + inputs al final** (Setup, BusinessEdit, CashClosure, Payment, OpenCash) el botón principal ("Guardar", "Confirmar", "Abrir caja") puede quedar cubierto por el teclado o el scroll debe usarse a ciegas. En dispositivos POS pequeños (altura 480-560) el teclado numérico tapa hasta el 50% → crítico para flujo de cobro.

### HECHO (diseño de confirmación)
Todos los campos comparten `TextField` que en iOS tiene `KeyboardAvoidingView` solo en el screen, no en el componente; el cierre del teclado se hace vía `onSubmitEditing`/`returnKeyType` en `TextField.tsx` (lo comparte). Montajes `keyboardShouldPersistTaps"handled"` (Invoice, Cart) y `keyboardDismissMode="on-drag"` (Cart, Ventas) — en Android `on-drag` + teclado puede no disparar si no hay drag; mayor robustez lograría `keyboardDismissMode="interactive"` en iOS y `on-drag` en Android.

### Clasificación
- **CRÍTICO** — `CashClosureScreen` (sin KAV, muchos inputs de denominaciones, botón "Cerrar caja" al final; en Android teclado numérico puede tapar la fila inferior). *Requiere device.*
- **ALTO** — `SetupScreen` (8 campos, último botón abajo, solo iOS-kind handling). `PaymentScreen` (botón confirmar tras money fields). `OpenCashScreen` (botón bajo input en panel fijo sin KAV Android). `BusinessEditScreen` (logo + 5 campos).
- **MEDIO** — `LoginScreen` recovery forms (multi-step condicional, KAV solo iOS), `CartScreen` customer panel, `ProductFormScreen`, `Providers/Customers`.
- **BAJO** — `VentasScreen` search (single input, arriba).

---

## 5. Responsive / dispositivos

### HECHO
- `Screen.tsx`: `contentMaxWidth` = `width >= 720 ? 840 : 560` (línea 22). `Column.tsx`: `maxWidth 560`.
- `InvoiceScreen.tsx`: grid responsive por `useWindowDimensions` — `numColumns = width>=1024?4 : width>=720?3 : 2` (línea 38). `ProductCard minHeight 176`.
- `HomeScreen`: `width >= 720` para layout 2 columnas.
- Padding/márgenes en px fijos en todas: `padding: 24` (Setup 172, Home, Cart header), `container padding:24`.
- `DashboardScreen`: **no usa `useWindowDimensions`** (estilo fijo).
- `KitchenScreen`: **usa `.map` directo, no FlatList/ScrollView** (293 líneas) — en muchos pedidos desborda sin scroll.

### INTERPRETACIÓN
- **Dispositivo pequeño (POS 320-360px de ancho):** `padding:24` en ambos lados deja ~272px útiles; en grid de Invoice con `numColumns=2` cada tarjeta ≈ (272-24)/2 ≈ 115px — el **input de cantidad de 42px + botón +** caben mal, el texto de precio puede truncar (`MoneyDisplay sizes` con `adjustsFontSizeToFit` mitiga). La `CartBar` fija ocupa altura; en 480-560px de alto con teclado abierto puede tapar el botón.
- **Dispositivo grande / phablet / POS:** `width >= 720` da 3 columnas en Invoice — mejor densidad, pero `HomeScreen` y `Dashboard` mantienen tarjetas anchas que en portrait 720-920 no se dividen; el hecho de que `maxWidth 840` centre bien.
- **Orientación landscape:** no hay bloqueo; al rotar en POS con `width>=720` cambia grid — razonable. Predicción: en landscape chico (320-480 alto), footer fijo cubre listas si no hay FlatList que ajuste.

### Clasificación (probable por tamaño, requiere device para confirmar)
- `InvoiceScreen` grid 2-col en 320px: **PROBABLE** overflow de cantidad+precio.
- `KitchenScreen`: **CONFIRMADO** sin scroll (listado directo) — desborda en muchos pedidos.
- `CashClosureScreen` en 320px: denominaciones en fila única con input 72px min + labels → **PROBABLE** apretado.

---

## 6. Formularios

### HECHO (revisado por archivo)
- **SetupScreen (232)**: 8 campos (nombre, propietario, usuario, password, confirmar, teléfono, correo, dirección) en 1 ScrollView; validación inline con errores; **no hay stepper** (1 pantalla), botón de envío en la parte baja; maneja `keyboardShouldPersistTaps`. No `KeyboardAvoidingView` en Android.
- **BusinessEditScreen**: 5 campos + image picker logo; guarda categoría/proveedor con sugerencias.
- **SecurityScreen**: 5 campos (usuario, pregunta, respuesta, new/confirm pass) condicionales; `KeyboardAvoidingView` iOS-only.
- **Customers/Providers**: 4 campos + guardar cliente; FlatList de sugerencias.
- **ProductFormScreen**: campos nombre, precio (sanitize money), categoría (chips + renombrado), stock, imagen (emoji/icon/foto).

### INTERPRETACIÓN
Todos usan `TextField` compartido (labels arriba, error inline, `returnKeyType`/dismiss en iOS). La mayor carencia transversal: **no hay `label` fijo en `QuickEditModal`/`QuickEditModal` y en `OpenCash` el "label" es placeholder-only**; y en Android no hay `KeyboardAvoidingView` en la mayoría → campos del fondo fuera de alcance visual. Faltan `maxLength` en text inputs y `onSubmitEditing` encadenado entre campos (solo `returnKeyType`).

---

## 7. Navegación

- `RootNavigator.tsx`: `headerShown: false` **global**; cada pantalla implementa su propia "Volver" (chevron/back chevron) — inconsistente: algunas usan `close`, otras `chevron-back`, otras solo el botón de hardware.
- Screens con **solo hardware back** (sin botón visible): `OrderDetailScreen`, `KitchenScreen`, `SecurityScreen`, `DevicesScreen`, `DashboardScreen`, `CustomersScreen` (listado), `ProvidersScreen` (listado), `BusinessSwitcherScreen` — en POS Android sin back físico la navegación se pierde.
- `BusinessSwitcherScreen`, `CustomersScreen`, `ProvidersScreen` usan `FlatList` dentro de `Screen` — correcto.
- No hay pantalla de "confirmation" global de `Alert` para acciones destructivas en algunos lugares (anulación pide motivo — correcto).

---

## 8. Accesibilidad (identificación de problemas — no implementación)

- **Contraste:**
  - `colors.textSecondary #6C7A89` sobre `surface #FFFFFF` ≈ **4.3:1** (bajo 4.5 AA para texto normal) — usado en captions y subtítulos por todas partes.
  - `colors.primary #00B8A9` sobre `surface` ≈ 2.4:1 — chips de categoría activos con texto primario sobre primaryLight (#D9F6F3) → bajo contraste en texto "semibold".
  - `colors.danger #EF4444` sobre `'#EF44441F'` ≈ bajo; banner blanco sobre primary `#00B8A9` ≈ 2.9:1.
- **Touch targets <44pt:** iconos circulares 42-44 (BusinessSwitcher iconCircle 44 ok), `ReceiptPreviewModal` si `logo 64x64` no es táctil; `SettingsRow` rows con icono de 22-24 + chevron con `hitSlop` puntual; `OpenCashScreen` `iconCircle 80` ok. `PrimaryButton minHeight 56` correcto. Botones de icono (add, delete) son `46x42` en algunos casos.
- **Font scaling:** `typography.sizes` en px fijos; no se usa `allowFontScaling={false}` (RN escala por defecto) → en Android con fuente aumentada muchos textos fijos (lineHeight 22, letterSpacing) pueden cortarse, especialmente `TextField` con minHeight 52.
- **Placeholders como labels:** `OpenCashScreen` usa placeholder para el monto; `SetupScreen`/`LoginScreen` usan labels reales bien.
- **Iconos sin contexto:** íconos de eliminar solo icono sin "accessibleLabel" en varias filas (texto de peligro en `Pressable` solo icono).
- **Color-only:** estado de activo/inactivo en lista productos usa color (surface opacity 0.55) + texto "Inactivo" — bien (doble codificación). `MoneyDisplay` sizes usan color + tamaño — bien.

---

## 9. UX para POS

- **Layout fijo inferior (`footer`/`cartBar`/`total`)**: en `InvoiceScreen` el carrito es una `CartBar` inferior fija con subtotal y botón "Ver carrito" — buena práctica POS.
- **Conteo rápido:** `QuickEditModal` para cambiar precio/stock rápido — alineado.
- **Cantidad de toques:** agregar = tocar `+`; cambiar cantidad = editar TextInput inline (2 toques). Aceptable.
- **Riesgo de error humano:** inputs de cantidad libres (sin `maxLength`) pueden capturar ceros de más; botones `+`-`-` pequeños (42px) en Cart; total en `MoneyDisplay` con `adjustsFontSizeToFit` (cambios de tamaño).
- **Un solo pulgar:** botones primarios amplios; pero segmentos (caja/mesero) requieren dos manos en tablet.
- **POS pequeño:** `InvoiceScreen` grid 2-col estrecha con padding 24 — puede requerir scroll horizontal para cantidad; mejora con padding reducido en <360px.
- **Impresión:** `usePrinter` + modales de preview — buen flujo.

---

## 10. Rendimiento UI

- **Diagnóstico:** `CartContext` re-renderiza a todos los consumidores en cada pulsación de cliente (memo con deps inestables) — **probable** lag en dispositivos lentos.
- **FlatList grid con `initialNumToRender 20`** — correcto.
- `KitchenScreen` `.map` directo (sin FlatList) — **confirmado** riesgo con muchas órdenes.
- `Dashboard` carga todas las órdenes pagadas en memoria para agregar 7 barras — **probable** cuello en historial grande.

---

## 11. Matriz de compatibilidad

| Área | Pantalla | Problema | Dispositivo afectado | Severidad | Evidencia |
|------|----------|---------|---------------------|-----------|----------|
| Teclado | CashClosure | Sin KAV; inputs denominación + botón cerrado al fondo | ABS Android (adjustResize ausente) | CRÍTICO | CashClosureScreen.tsx (sin import KAV; 149-184) |
| Teclado | Setup | 8 campos, botón bajo ScrollView; KAV solo iOS | Android POS chico | ALTO | SetupScreen.tsx:103, 172 |
| Teclado | OpenCash | Botón bajo input fijo, KAV iOS-only | Android | ALTO | OpenCashScreen.tsx:45 |
| Teclado | Payment | Money fields + confirmar sin KAV | Android | MEDIO | PaymentScreen.tsx |
| Responsive | Invoice | Grid 2-col 320px + input 42px + padding 24 | POS 320-360 | PROBABLE | InvoiceScreen.tsx:38, 39 |
| Responsive | Kitchen | .map sin scroll | TODOS (muchos pedidos) | ALTO | KitchenScreen.tsx (159+) |
| Assets | Icon | Foreground fuera de safe-zone + icon 1024 sin padding | Launcher Android/APK | CRÍTICO | app.json:40-44; pixels |
| Assets | Logo ticket | MIME png hardcodeado con posibles JPEG | Todos los impresores | MEDIO | printerService.ts:94-97 |
| Formularios | Varios | labels placeholder-only en QuickEdit/OpenCash | Todos | BAJO | components/QuickEditModal.tsx |
| Accesibilidad | Global | Contraste textSecondary 4.3:1; captions | Todos | ALTO | theme/colors.ts |
| Navegación | Subpantallas | headerShown false sin back propio | POS sin HW back | MEDIO | RootNavigator.tsx:47 |
| Perf | Cart | Re-render todo el árbol por keystroke | Android lento | PROBABLE | contexts/CartContext.tsx |
| Perf | Dashboard | Carga historial completo en memoria | Grandes | PROBABLE | DashboardScreen.tsx |

---

## 12. Priorización

(ver §13 plan por fases; líneas sugeridas de arranque)

---

## 13. Plan de corrección futuro (NO implementado)

### Fase UI-0 — Críticos (APK + teclado pos)
- Assets de icon (safe-zone, padding), fix MIME logo impresión.
### Fase UI-1 — Teclado
- Aplicar KAV + `keyboardShouldPersistTaps` y `keyboardDismissMode` consistente en CashClosure, Setup, Payment, OpenCash, BusinessEdit.
### Fase UI-2 — Responsive
- Reducir padding en <360px; grid POS dinámico; convertir Kitchen a FlatList.
### Fase UI-3 — Formularios
- Labels fijos, maxLength, encadenar submit.
### Fase UI-4 — Consistencia material
- Chequear ese set de datos (ya es bueno).
### Fase UI-5 — Accesibilidad
- Ajustar contraste textSecondary/primaryLight; touch 44px; permitir fontScale.
### Fase UI-6 — Perf
- Aislar re-render de CartContext; Dashboard consulta agregada.

**Archivos involucrados:** per archivo arriba. **Riesgo/dependencias:** ninguna dependencia nueva; solo cambios de estilo/config dentro de lo existente. **Pruebas:** matriz §15.

---

## 14. Matriz de pruebas manuales (para fase de implementación)

| Pantalla | Pequeño / Medio / Grande / POS | Teclado abierto | Estado |
|----------|-------------------------------|-----------------|--------|
| Setup | ✔/✔/✔/✔ | ✔ | pendiente |
| Login (3 modos) | ✔ | ✔ (recovery) | pendiente |
| Facturación | ✔ | ✔ (search) | pendiente |
| Cart + customer | ✔ | ✔ | pendiente |
| Payment | ✔ | ✔ (efectivo) | pendiente |
| CashClosure | ✔ | ✔ (denominación) | pendiente |
| ProductForm | ✔ | ✔ | pendiente |
| Ventas (búsqueda, rango) | ✔ | ✔ | pendiente |
| Kitchen (50+ órdenes) | ✔ | — | pendiente |
| DatosYRespaldo | ✔ | — | pendiente |
| Config/Dispositivos/Security | ✔ | ✔ | pendiente |
| APK: icon launcher, logo ticket (PNG/JPEG), 2 launchers, splash, orientación, escala de fuente, pantalla larga, sin datos, lista larga, imagen inexistente, producción. | | | |

### Situaciones clave
- fuente Android aumentada (150%) en todos los formularios.
- teclado numérico cerrado/abierto; teclado de texto; rotación; modal abierto con teclado.
- formulario incompleto; error de validación; sin respaldo; muchos productos (500+); imagen rota (uri inexistente).

---

## 15. HECHOS / INTERPRETACIÓN / OPCIONES FUTURAS / REQUIERE PRUEBA

### HECHOS
- `KeyboardAvoidingView` solo aplica en iOS (behavior condicionado a `Platform.OS === 'ios'`) en: Login(340,559…), Invoice, Cart, OpenCash(45), Setup(103), BusinessEdit, Customers, Providers, Security. `CashClosureScreen` no lo importa.
- `app.json:40-44` adaptiveIcon usa `backgroundColor #FFFFFF` + foreground PNG sin padding seguro; `icon.png` 1024 lleno a borde.
- `printerService.ts:94-97` `logoDataUri` fuerza MIME `image/png`.
- `Screen.tsx:22` maxWidth 560/840 por `width`; `InvoiceScreen.tsx:38` grid 2/3/4 col.
- `KitchenScreen` `.map` sin FlatList; `CartContext` re-render todo el árbol; `Dashboard` carga todas las órdenes.
- `TextField` compartido maneja labels/errores/returnKey; `PrimaryButton minHeight 56`.

### INTERPRETACIÓN
- Android tiende a tapar campos/botones del fondo en formularios; teclado numérico POS agrava en CashClosure/Setup/Payment/OpenCash.
- Icono/logo APK recortado o inadecuado por falta de zona segura → "no se ve bien".
- Logo de ticket puede fallar con JPEG.
- Grid 2-col + padding 24 se aprieta en 320px; Kitchen desborda; re-render de cart y agregación de dashboard degradan POS grandes.

### OPCIONES FUTURAS
- KAV + `keyboardShouldPersistTaps` + `keyboardDismissMode` consistentes (sin nuevas libs).
- Regenerar asset de icon con safe-zone y padding transparente; normalizar MIME del logo.
- Padding responsive (<360px) y FlatList en Kitchen.
- Aislar re-render de Cart (memoizar selectores); consulta agregada de ventas.
- Revisar contraste textSecondary/primaryLight y touch 44px; no tocar fuentes para permitir escalado.

### REQUIERE PRUEBA EN DISPOSITIVO
- Comportamiento real del teclado en Android (pos vs teléfono; con y sin `adjustResize`).
- Aspecto del icon en distintos launchers/Play.
- Logo de ticket con JPEG y con PNG en impresora térmica y vista previa.
- Desbordes en grid 2-col en 320px y landscape.

---

## 16. Conclusiones

Vendelo tiene una base UI sólida (tokens, componentes compartidos, grid y botones bien dimensionados). Los problemas reales están concentrados en: (1) **manejo del teclado responsivo solo en iOS** — afecta los formularios y sobre todo el flujo de cierre/efectivo en POS Android; (2) **assets del icono fuera de zona segura** — explicación más probable del defecto del APK; y (3) **contraste y toque** en labs por debajo del AA. Ninguna requiere reescritura ni dependencias nuevas: se resuelven reposicionando `KeyboardsAvoidingView`/dismiss y regenerando los png del icon. Las pruebas en dispositivo son obligatorias para los tres bloques críticos antes de declarar el fix.
