# Informe F8.1 — Cocina / Comandas

## Alcance
- Esperado: KitchenTicket, prepStatus, nuevo/actualizar/cancelar comanda, RequireCapability("kitchen").
- Implementado: backend endpoints de cocina, modelo KitchenTicket, UI Cocina, navegación desde facturación.

## Backend — Estado

### `backend/src/Vendelo.Api/Endpoints/KitchenEndpoints.cs`
3 endpoints, todos protegidos con `RequireCapability(a, "kitchen")`:

- `POST /orders/{orderId}/kitchen` — Crea KitchenTicket para una orden pendiente. Asigna `KitchenTicketId`, establece `prepStatus = 'sent'`. Valida que la orden exista y esté en status 'pending'.
- `POST /orders/{orderId}/kitchen/status` — Actualiza `prepStatus` con validación de transiciones válidas: sent→preparing→ready→served. Rechaza transiciones inválidas con `400 invalid_kitchen_status`.
- `DELETE /orders/{orderId}/kitchen` — Cancela comanda de cocina: elimina el KitchenTicket y resetea `KitchenTicketId` y `prepStatus` en la orden.

### Validaciones
- No se puede crear ticket si no hay orden pendiente.
- Transiciones de prepStatus son estrictamente secuenciales.
- No se puede actualizar status de una orden sin ticket de cocina.
- Todos los endpoints requieren capability `kitchen` activa en el negocio.

### Registro
- `Program.cs`: `app.MapKitchenEndpoints()` registrado.

## Cliente — Cambios implementados

### Modelo (`src/models/kitchenTicket.ts`)
- `KitchenTicket`: id, orderId, orderNumber, prepStatus, waiterName, tableName, customerName, subtotalCents, itemCount, createdAt.

### Servicios (`src/services/kitchenApi.ts`)
- `apiCreateKitchenTicket(orderId)` — POST /orders/{id}/kitchen
- `apiUpdateKitchenStatus(orderId, prepStatus)` — POST /orders/{id}/kitchen/status
- `apiCancelKitchenTicket(orderId)` — DELETE /orders/{id}/kitchen

### Pantalla (`src/screens/kitchen/KitchenScreen.tsx`)
- Muestra comandas con prepStatus actual (badge coloreado).
- Botón "Enviar a cocina" para órdenes pendientes sin ticket.
- Botón de avance de estado (Enviar→Preparando→Lista→Entregada) para comandas con ticket.
- Botón "Cancelar comanda" para comandas en proceso.
- Visible solo cuando `kitchen` capability está ACTIVA.
- Navegable desde InvoiceScreen ("Ir a Cocina") cuando capability está activa.

### Navegación
- `src/navigation/types.ts`: `Kitchen: undefined` en RootStackParamList.
- `src/navigation/RootNavigator.tsx`: KitchenScreen registrado como Stack.Screen.
- `src/screens/home/InvoiceScreen.tsx`: botón "Ir a Cocina" cuando kitchen capability ON.

### Modelo Order (`src/models/order.ts`)
- Nuevo campo opcional `kitchenTicketId?: string` en Order.

## Verificación
- TypeScript: 0 errores.
- Tests: 298/298 pass, 35 suites.
- Backend dotnet build: 0 errores.
- INFORME: `docs/INFORME-F8.1.md`.
