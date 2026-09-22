# Informe F8 — Comandas / Meseros

## Alcance
- Esperado: mesero (WAITOR), waiterId, pending orders, tableId/customerId, events, regla anti-anónima.
- Implementado: modelo Order ampliado, sync incluye campos, UI toggle modo mesero, backend valida anti-anónima.

## Backend — Estado
La infraestructura para órdenes de mesero ya existe en `OrderEndpoints.cs`:
- `orderType == "waiter"` → `RequireCapability(a, "waiters")`.
- Anti-anónima: `orderType='waiter'` requiere `waiterId` + (mesa O cliente) → `400 anonymous_order`.
- `WaiterId`, `WaiterName`, `TableId`, `TableName` en modelo Order y DTOs.
- `RequiresCapability` y `Require` (permisos) coexisten.
- Roles WAITOR/kitchen/printer en AccessService matrix.
- `POST /businesses/{id}/members` para alta de meseros (F8 completo requiere UI de roles).

## Cliente — Cambios implementados

### Modelo (`src/models/order.ts`)
- Nuevos tipos: `OrderType`, `OrderPrepStatus`, `OrderEvent`, `CustomerData` con `customerId`.
- `Order` ampliado: `orderType`, `waiterId`, `waiterName`, `tableId`, `tableName`, `prepStatus`, `events`.

### Utils (`src/utils/order.ts`)
- `buildOrder` acepta `orderType`, `waiterId`, `waiterName`, `tableId`, `tableName`, `prepStatus`, `events` con defaults (`orderType='counter'`, `events=[]`).

### Servicios
- **`src/services/orderService.ts`**: `savePendingOrder` y `payNewOrder` aceptan y propagan campos de mesero/mesa.
- **`src/services/syncService.ts`**: `toOrderBatch` incluye `orderType`, `waiterId`, `waiterName`, `tableId`, `tableName`, `prepStatus`, `customerId`, `customerDescription`, `events`.

### Contexto
- **`src/contexts/CartContext.tsx`**: nuevo estado `waiter` (`WaiterInfo`), `isWaiterOrder`, `setWaiterOrder`, `setWaiter`. Limpieza automática al limpiar carrito.

### UI (`src/screens/home/InvoiceScreen.tsx`)
- Toggle "Modo mesero" cuando `waiters` capability está ON.
- Muestra estado de orden de mesero (activo/inactivo).
- Usa `useAuth()` para verificar capacidades.

### Pantallas de pago
- **`src/screens/payment/PaymentScreen.tsx`**: pasa `orderType`, `waiterId`, `waiterName`, `tableId`, `tableName` a `savePendingOrder`. Muestra info de mesero en resumen.
- **`src/screens/payment/PaymentMethodScreen.tsx`**: propaga campos de mesero a `payNewOrder`.

## Tests
- Actualizados 5 archivos de test para incluir `orderType: 'counter'` y `events: []` en Order objects.
- 298/298 tests pasan. 35 suites.

## Próximos pasos (F8.1)
- KitchenTicket creation/management
- prepStatus flow (new → sent → preparing → ready → served)
- Comanda creation/update/cancel via kitchen endpoints
- `POST /orders/{id}/kitchen`, `POST /orders/{id}/kitchen-status`
