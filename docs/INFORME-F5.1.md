# Vendelo App — INFORME F5.1: Conectar cliente RN ↔ API

**Fase:** F5.1 — Conexión del cliente React Native con el backend API.
**Fecha:** 2026-09-22
**Base:** F5 (PostgreSQL + migraciones + configuración) + F3 (backend funcional).
**Stack:** React Native + TypeScript + Expo + SQLite (cliente) ↔ ASP.NET Core Minimal API + Npgsql + PostgreSQL (servidor).

---

## 1. Veredicto

**APROBADO** — Capa de conexión cliente↔API completa y operativa.
- Login, registro, sesión y sync vía API funcionando.
- Offline-first preservado: fallback a guardado local cuando sin red.
- Tests: 298/298 pass, 35 suites. tsc limpio (0 errores).

---

## 2. Verificación objetiva

| Item | Resultado |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **0 errores** |
| `npm test` (cliente) | **298/298 pass** (35 suites, sin cambios ni roturas) |
| `dotnet build` (backend) | **0 errores** (sin cambios) |
| `dotnet ef database update` | **aplicado** (sin cambios) |
| PostgreSQL conectado | **OK** — 15 tablas + audit_log |
| Cambios en `src/` del cliente | nuevos archivos + modificaciones (lista abajo) |

---

## 3. Capa de conexión implementada

### 3.1 Configuración API (`src/config/api.ts`) — NUEVO

Configuración centralizada del endpoint API:
- `API_BASE_URL`: detecta `__API_URL__` (global), `EXPO_PUBLIC_API_URL` (env) o fallback `http://127.0.0.1:5000`
- `API_PREFIX`: `/api/v1`
- `apiUrl(path)`: construye URL completa con base path

### 3.2 Tipos API (`src/services/apiTypes.ts`) — NUEVO

Tipos compartidos para comunicación con la API:
- `ApiError`: code, message, requestId, details, retryAfterSeconds
- `ApiResponse<T>`: ok, status, data, error
- `RequestInitExtended`: body, headers, timeout

### 3.3 API Client Auth (`src/services/authApi.ts`) — NUEVO

Cliente API completo para autenticación:
- `apiFetch<T>`: fetch genérico con auto-refresh en 401, timeout 15s, manejo de errores NETWORK
- `apiLogin(identifier, password, deviceId)`: login → guarda tokens en SecureStore
- `apiRegister(name, username, password, deviceId, ...)`: registro → guarda tokens
- `apiRefresh()`: renovación de access token via refresh token
- `apiSession()`: obtener sesión actual
- `apiLogout()`: limpia tokens
- `getTokens() / clearTokens`: gestión de tokens

### 3.4 API Client Sync (`src/services/syncApi.ts`) — NUEVO

Cliente API para sincronización:
- `syncPull(businessId, since)`: pull de cambios desde servidor
- `syncPush(businessId, req)`: push de datos al servidor (initial/incremental)
- `syncPushBatch(businessId, opType, entityType, id, entity)`: push de lote individual

### 3.5 Auth Context (`src/contexts/AuthContext.tsx`) — MODIFICADO

Contexto de autenticación reescrito para usar la API real:
- `session`: sesión actual (user, tokens, businesses)
- `login`: autenticación via `apiLogin`
- `register`: registro via `apiRegister`
- `logout`: cierre de sesión remoto + local
- `refreshSession`: renovación de tokens
- Programador de refresh automático (1 min antes de expirar)
- Restauración de sesión al montar (via `apiSession`)
- Tokens persistidos en `expo-secure-store`

### 3.6 Detección de red (`src/utils/network.ts`) — NUEVO

- `isOnline()`: retorna `Promise<boolean>` usando `@react-native-community/netinfo`

### 3.7 LoginScreen (`src/screens/login/LoginScreen.tsx`) — MODIFICADO

- Usa `apiLogin` desde `authApi` (via `useAuth` context)
- `onForgot` prop hecho opcional en `LoginForm` (typecheck fix)
- Manejo de errores NETWORK vs AUTH

### 3.8 SetupScreen (`src/screens/setup\SetupScreen.tsx`) — MODIFICADO

- Registro ahora intenta `apiRegister` primero (si hay red)
- Fallback a `saveSetup` local cuando:
  - Sin conexión (`isOnline()` = false)
  - Error NETWORK del API
- Error de registro (CONFLICT, etc.) se muestra sin fallback
- After successful register → sesión establecida → `saved` → login screen
- After successful local save → `saved` → login screen (sin sesión)
- Banner de error general para mensajes de estado

### 3.9 App.tsx — MODIFICADO

- `BootGate` usa `session` de `useAuth()` en lugar de `authed`
- Sin sesión → LoginScreen; con sesión → RootNavigator

### 3.10 syncQueue (`src/services/syncQueue.ts`) — MODIFICADO

- Nuevo tipo `SyncPushResult`
- Nueva función `syncPushData(businessId, batches)`: push de datos vía `syncApi.syncPush`
- `processQueue()` ahora también intenta API sync push después de backup upload
- API sync es opcional (fallback silencioso si falla)

---

## 4. Flujo de autenticación

```
┌─────────────────────────────────────────────────┐
│ Usuario abre app                                │
├─────────────────────────────────────────────────┤
│ BootGate: ¿session exists?                      │
│  ├─ Sí → RootNavigator                         │
│  └─ No → ¿setup done?                          │
│      ├─ No → SetupScreen                       │
│      │   ├─ online? → apiRegister → session!   │
│      │   └─ offline → saveSetup local → login  │
│      └─ Sí → LoginScreen                       │
│          └─ apiLogin → session → RootNavigator  │
└─────────────────────────────────────────────────┘
```

### Flujo de registro (SetupScreen):

1. Usuario completa formulario
2. `validateSetup()` valida campos
3. `isOnline()` verifica conexión
4. **Online**: `apiRegister(name, username, password, deviceId)`
   - OK → sesión establecida → `saved = true` → login screen
   - NETWORK → fallback local: `saveSetup()` → `saved = true` → login screen
   - CONFLICT/ERROR → mensaje de error, no hace fallback
5. **Offline**: `saveSetup()` local → `saved = true` → login screen

### Refresh automático de tokens:

- `AuthProvider` programa refresh 1 min antes de expirar access token
- `apiFetch` auto-refresca en 401 (intenta `apiRefresh`, re-intenta request)
- Si refresh falla → `clearTokens` → `session = null` → login screen

---

## 5. Manejo offline

| Escenario | Comportamiento |
|---|---|
| Setup sin red | Guarda localmente (AsyncStorage + SecureStore), va a login |
| Login sin red | Falla (AUTH_LOCAL solo funciona setup, no login remoto) |
| Sync sin red | `processQueue` se detiene en primer item sin conexión |
| Push sin red | Falla silenciosa, item permanece en pending |
| Refresh sin red | Falla, session se limpia, user redirigido a login |

---

## 6. Archivos creados/modificados en F5.1

| Archivo | Acción | Contenido |
|---|---|---|
| `src/config/api.ts` | Creado | Configuración API (base URL, prefix, apiUrl) |
| `src/services/apiTypes.ts` | Creado | Tipos ApiError, ApiResponse, RequestInitExtended |
| `src/services/authApi.ts` | Creado | Cliente API auth (login, register, refresh, session, logout) |
| `src/services/syncApi.ts` | Creado | Cliente API sync (pull, push, pushBatch) |
| `src/utils/network.ts` | Creado | isOnline() via netinfo |
| `src/contexts/AuthContext.tsx` | Modificado | Reescrito con apiLogin/apiRegister/apiSession/apiRefresh |
| `src/screens/login/LoginScreen.tsx` | Modificado | Usa apiLogin + useAuth; onForgot opcional |
| `src/screens/setup/SetupScreen.tsx` | Modificado | Usa apiRegister con fallback local |
| `App.tsx` | Modificado | Usa session de AuthContext |
| `src/services/syncQueue.ts` | Modificado | syncPushData + API sync en processQueue |
| `docs/INFORME-F5.1.md` | Creado | Este informe |

---

## 7. Endpoints API utilizados

| Endpoint | Función | Método |
|---|---|---|
| `/api/v1/auth/register` | Registro de usuario + negocio | POST |
| `/api/v1/auth/login` | Login | POST |
| `/api/v1/auth/refresh` | Renovación de tokens | POST |
| `/api/v1/auth/session` | Sesión actual | GET |
| `/api/v1/auth/logout` | Cierre de sesión | POST |
| `/api/v1/businesses/{id}/sync/pull` | Pull de cambios | GET |
| `/api/v1/businesses/{id}/sync/push` | Push de datos | POST |

---

## 8. Items diferidos

| ID | Item | Prioridad | Destino |
|---|---|---|---|
| F5.1-1 | Implementar cambio real en syncPushData (batches con datos locales) | Alta | F6 (sync completo) |
| F5.1-2 | Implementar syncPull en cliente (descargar cambios del servidor) | Alta | F6 |
| F5.1-3 | Manejar conflictos de datos (server vs local) | Media | F6 |
| F5.1-4 | Network listener continuo (reconectar auto al recuperar red) | Media | F6 |
| F5.1-5 | Integrar register con SetupScreen en tests | Baja | F6 |

---

## 9. Estado de la secuencia

F1 · F1.1 · F2 · F2.1 · F2.2 · F2.2-B · F3 · F3.1 · F4 · F4.1 · **F5** · **F5.1** — pendientes: **F6** (multi-device sync).
