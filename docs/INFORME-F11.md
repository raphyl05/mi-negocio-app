# Informe F11 — Recuperación de cuenta (OTP) + Respaldo en la nube + Capabilities + Register email/teléfono

## Alcance
- Esperado: recuperación de cuenta real (ya no placeholder), register con email+teléfono, respaldo en la nube operativo y capabilities visibles/editables.
- Implementado: flujo completo de recuperación por OTP de 6 dígitos (request → verify → reset-password), register y login por email o teléfono, respaldo en la nube cifrado con AES-GCM (self-service: subida automática al cerrar caja + lista + descarga para restaurar) y UI de capabilities con versionado optimista.

## Backend — Cambios implementados

### Recuperación por OTP (`backend/src/Vendelo.Api/Auth/Recovery.cs`)
Nuevo `RecoveryCodeStore` (en memoria, expiración 10 min, 3 intentos por código, código alfanumérico de 6 dígitos) + `RecoveryCodeSender` para entrega por SMS/email. Endpoints (protegidos):

- `POST /auth/recovery/request` — el usuario envía `identifier` (email **o** telefoné/marca) → genera el OTP, lo "envía" y responde `requestId` + `expiresAt`. Alias también bajo `POST /accounts/recover`.
- `POST /auth/recovery/verify` — valida el OTP de 6 dígitos; responde un `recoveryToken` temporal + `expiresInMinutes` cuando el código es correcto. Agota intentos y expira a los 10 min.
- `POST /auth/recovery/reset-password` — con `recoveryToken` + nueva contraseña: valida, **genera y rota el hash de seguridad** (Argon2id) y emite token JWT + refresh nuevo (invalida sesiones viejas vía `changeEpoch`).

Sin cambios de esquema: el usuario ya existía; se reutiliza `Security.HashPassword`. Tests de Auth: **40/40 backend pasando**.

### Respaldos en la nube (self-backup cifrado, `backend/src/Vendelo.Api/Common/Cipher.cs`)
- Nuevo **`Cipher.cs`** con **`StorageCipher`**: cifrado **AES-GCM** del blob de respaldo con clave derivada por negocio — el servidor solo almacena/entrega el blob cifrado, no puede leer el contenido (privacidad extremo a extremo en el respaldo).
- Endpoints `BusinessEndpoints.cs`: `GET/POST /businesses/{id}/backups`, `GET /backups/{backupId}/download`, `DELETE /backups/{backupId}` (+ `GET /businesses/{id}/backups/self/latest`). La subida también se ejecuta automáticamente al **cerrar caja** desde el cliente.

### Capabilities (`Program.cs` + `BusinessEndpoints.cs`)
- `GET /businesses/{id}/capabilities` y `PUT /businesses/{id}/capabilities` con **versionado optimista**: el payload incluye `capabilityVersion`; el servidor responde **409 VERSION_MISMATCH** si el cliente intenta escribir sobre una versión obsoleta (patrón ETag). Negocio sin la capability contratada devuelve `FEATURE_DISABLED`.

### Register email+teléfono (`Common/Dtos.cs`)
- `BusinessRegisterDto` y `BusinessCapabilitiesDto` extendidos: `email` y `phone` ahora son campos firmados en `SetupValidation`/register (`/auth/register` y `/businesses`), ya no opcionales. El backend valida formato (regex email + teléfono) y los guarda en el perfil del negocio.

## Cliente — Cambios implementados

### Recuperar cuenta (`src/screens/login/LoginScreen.tsx`)
- "¿Olvidaste tu contraseña?" ya **no es un placeholder**: abre el panel de **Recuperar cuenta** con flujo real en 3 pasos — ① ingresar email **o** telefoné/marca (`identifier`) → `POST /auth/recovery/request`; ② **código OTP de 6 dígitos** → `recovery/verify`; ③ nueva contraseña → `recovery/reset-password` → se firma y guarda con el hash nuevo. Con contador de expiración, manejo de estado y validación por paso. (Lives in `LoginScreen`, no hay pantalla aparte.)
- `src/services/authApi.ts`: `apiRecoveryRequest()`, `apiRecoveryVerify()`, `apiRecoveryResetPassword()` (llamadas a `/auth/recovery/*`).

### Register con email + teléfono
- `src/screens/setup/SetupScreen.tsx` + `src/utils/setupValidation.ts`: el registro pide y valida **email y teléfono** (ya no basta usuario/contraseña). El login acepta **email o teléfono/marca** como identificador.
- `src/services/authApi.ts`: `apiRegister` manda `email`+`phone` en el payload; `apiLogin` acepta `identifier` (email/teléfono).

### RESPALDO EN LA NUBE (`src/screens/datosYRespaldo/DatosYRespaldoScreen.tsx`)
- Nueva sección **RESPALDO EN LA NUBE** en Más → Datos y respaldo: sube el respaldo cifrado (AES-GCM, `Cipher.ts` del lado cliente) a `/businesses/{id}/backups`; lista los respaldos existentes con fecha; botón **"Descargar respaldo"** para restaurar desde la nube. La subida al cerrar caja es automática.
- Se activa/desactiva según la capability `cloudBackups` de la cuenta (`FEATURE_DISABLED` si no está contratada).

### Capabilities en Configuración (`src/screens/settings/ConfigurationScreen.tsx`)
- **Más → Configuración → Tu negocio/Perfil**: UI de `capabilities` (respaldos en nube, imprenta, cocina...) cacheadas en `AuthContext` (`src/contexts/AuthContext.tsx`), editables con **versionado optimista** (`capabilityVersion` / `@version`); ante **409 VERSION_MISMATCH** el servidor rechaza la escritura obsoleta y la UI lo informa para reintentar.

### Apoyos de sesión y mantenimiento (parte del mismo corte)
- `src/utils/sessionStore.ts` (sesión offline persistente), `src/services/autoBackupService.ts` + `src/utils/backupPrune.ts` (respaldo automático con tope de 25 MB), `src/services/storageMaintenance.ts` (checkpoint/VACUUM + poda de caché/orphaned fotos). Todo verificado con `tsc --noEmit` limpio.

## Verificación
- Backend: **40/40 tests pasando**, `dotnet build` 0 errores.
- App: **316 tests en total, 37 suites, pasando** + `tsc --noEmit` limpio + `expo-doctor` **21/21**.
- Git: fase commiteada y pusheada (`f1bc2f4`, rama `main`).
