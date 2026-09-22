# Informe F7 — Capacidades visibles + UI

## Alcance

Capacidades del negocio visibles: UI solo muestra lo activado; backend aplica `FEATURE_DISABLED`; `capabilityVersion` propaga cambios; desactivar no borra datos.

## Backend — Estado

La infraestructura de capacidades ya existe y funciona:

- **`AccessService.RequireCapability()`** (`backend/src/Vendelo.Api/Common/Access.cs:88-94`): verifica `business.capabilities[key]` → ON: permite, OFF: lanza `403 FEATURE_DISABLED` con mensaje descriptivo.
- **`GET /businesses/{id}/capabilities`** (`BusinessEndpoints.cs:119-124`): retorna `BusinessDto.From(a.Business)` incluyendo `capabilities`, `settings`, `capabilityVersion`. Cualquier miembro puede leer.
- **`PATCH /businesses/{id}/capabilities`** (`BusinessEndpoints.cs:126-150`): solo owner/admin; valida `expectedCapabilityVersion` → 409 VERSION_MISMATCH; normaliza capacidades (5 claves conocidas: restaurant, waiters, tables, kitchen, kitchenPrinting); sube `capabilityVersion` y `updatedAt`.
- **Normalización** (`BusinessEndpoints.cs:291-301`): `CapKeys = ["restaurant","waiters","tables","kitchen","kitchenPrinting"]`; todas OFF por defecto en bootstrap.
- **No destrucción**: `PATCH /capabilities` con OFF no borra datos (decisión F7/P.40.6).

### Requerimiento F7 pendiente

`RequireCapability` no es llamado por ningún endpoint actual porque los módulos restaurant (F8: meseros/comandas, F8.1: cocina, F9: impresión) no existen aún. Cuando esos módulos se implementen, se agregará `RequireCapability(a, "waiters"/"kitchen"/"kitchenPrinting")` a sus endpoints correspondientes. El patrón está listo y probado.

## Cliente — Cambios implementados

### `src/services/authApi.ts`
- **Nuevo tipo** `BusinessCapabilities`: `{ restaurant, waiters, tables, kitchen, kitchenPrinting }`
- **Nuevo tipo** `CapabilitiesResponse`: `{ businessType, capabilities, settings, capabilityVersion }`
- **Nueva función** `apiGetCapabilities(businessId)`: GET `/businesses/{id}/capabilities`, retorna `CapabilitiesResponse`

### `src/contexts/AuthContext.tsx`
- **Nuevo tipo** `BusinessCapabilities` (re-exportado)
- **Nuevo estado** `capabilities: Record<string, BusinessCapabilities>` — cacheado por `businessId`
- **`fetchCapabilities(businessId)`**: llama a `apiGetCapabilities`, normaliza a `BusinessCapabilities`, cachea, retorna o `null`
- **`hasCapability(businessId, key)`**: lee del cache, `false` si no existe
- Ambos métodos expuestos en `AuthContextValue` y accesibles vía `useAuth()`

### `src/screens/settings/ConfigurationScreen.tsx`
- Nueva sección **"CARACTERÍSTICAS DEL NEGOCIO"** que muestra 5 características:
  - Modo restaurante, Meseros, Mesas, Cocina, Impresión cocina
- Cada una muestra: icono, título, descripción y badge ACTIVA/INACTIVA basado en `hasCapability()`
- Los colores usan tema actual (inline styles, no estáticos)
- Corrección preexistente: import `NativeStackNavigationTypo` corregido de `@react-navigation/native` → `@react-navigation/native-stack`

## Verificación

- TypeScript: `tsc --noEmit` — 0 errores
- Tests: 298/298 pass, 35 suites
- Backend: `dotnet build` — 0 errores, 15 warnings (preexistentes, nullability)

## Próximos pasos (F8)

F8 (meseros) necesita `RequireCapability(a, "waiters")` en endpoints de órdenes que correspondan a meseros. F8.1 (cocina) necesita `RequireCapability(a, "kitchen")`. F9 (impresión) necesita `RequireCapability(a, "kitchenPrinting")`.

## Informe de cierre

- Capacidades: contexto + API cliente + UI funcionando
- Backend: infraestructura `FEATURE_DISABLED` lista para consumo de módulos restaurant
- `capabilityVersion`: propagación implementada en `PatchCapabilitiesAsync`
- No-destrucción: garantizada por diseño (PATCH solo cambia flags, no borra datos)
