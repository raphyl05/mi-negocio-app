# Vendelo App — INFORME F5: Despliegue + PostgreSQL + Migraciones

**Fase:** F5 — Despliegue, PostgreSQL real, pipeline de migraciones, hardening host.
**Fecha:** 2026-09-22
**Base:** F3 (backend implementado) + F3.1 (auditoría) + F4.1 (auditoría seguridad).
**Stack:** ASP.NET Core Minimal API (net10.0) + EF Core 10 + Npgsql (PostgreSQL 17).

---

## 1. Veredicto

**APROBADO CON ANOTACIONES** — PostgreSQL desplegado y verificado, pipeline de migraciones funcionando,
tablas creadas (15 EF + audit_log), tests pasan (40/40 backend, 298/298 cliente, tsc limpio).
Hardening aplicado segun alcance de F5; items E1/E2/E4/E5 diferidos a F6/F7.
No se modifico codigo del cliente (`src/` intacto).

---

## 2. Verificacion objetiva

| Item | Resultado |
|---|---|
| `dotnet build src/Vendelo.Api/Vendelo.Api.csproj` | **0 errores, 0 warnings** |
| `dotnet ef migrations add InitialCreate` | **Creado:** `Migrations/20260922002720_InitialCreate.cs` + Designer + Snapshot |
| `dotnet ef migrations script --project src/Vendelo.Api/Vendelo.Api.csproj` | **DDL generado** (263 lines, 15 tablas, 20 indices) |
| `dotnet ef database update --project src/Vendelo.Api/Vendelo.Api.csproj` | **Aplicado** en PostgreSQL `vendelo` |
| `dotnet test Vendelo.slnx` | **40/40 pass** (27 integracion + 13 seguridad F4.1) |
| `npm test` (cliente) | **298/298 pass** (sin cambios) |
| `npm run typecheck` (`tsc --noEmit`) | **sin errores** (sin cambios) |
| Backend conectado a PostgreSQL | **OK** — GET /api/v1/health responde |
| Tablas PostgreSQL | **16** (15 EF + audit_log) |
| Cambios en `src/` del cliente | ninguno |

---

## 3. PostgreSQL

| Item | Valor |
|---|---|
| Versión | PostgreSQL 17 |
| Host | 127.0.0.1 (IPv4; IPv6/::1 requiere scram auth — ver nota) |
| Puerto | 5432 |
| Base de datos | `vendelo` (creada) |
| Usuario | `postgres` (superusuario, trust auth en IPv4) |
| Auth | trust (127.0.0.1/32); scram-sha-256 (::1/128) — ver recomendaciones |
| Conexion string | `Host=127.0.0.1;Port=5432;Database=vendelo;Username=postgres;` |
| Provider | Npgsql (EF Core 10) |

**Nota auth:** `pg_hba.conf` tiene trust para 127.0.0.1/32 y scram-sha-256 para ::1/128.
En produccion, usar scram-sha-256 para todas las conexiones con contrasena real.
La app usa `Host=127.0.0.1` para evitar el requisito de contrasena IPv6.

---

## 4. Pipeline de migraciones

### Archivos de migracion (en repo)
- `backend/src/Vendelo.Api/Migrations/20260922002720_InitialCreate.cs` — migracion inicial (15 tablas)
- `backend/src/Vendelo.Api/Migrations/20260922002720_InitialCreate.Designer.cs`
- `backend/src/Vendelo.Api/Migrations/VendeloDbContextModelSnapshot.cs`

### Pipeline (despliegue futuro)
```bash
# 1. Crear DB (si no existe)
psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"

# 2. Aplicar migraciones EF
dotnet ef database update --project src/Vendelo.Api/Vendelo.Api.csproj

# 3. Crear tabla audit_log (script SQL en backend/deploy/001_create_audit_log.sql)
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f backend/deploy/001_create_audit_log.sql
```

### Program.cs — Cambio clave (F5)

**Antes (F3, D16):** `await db.Database.EnsureCreatedAsync();` — crea schema sin pipeline de migraciones.

**Ahora (F5):**
```csharp
if (dbProvider.Equals("Npgsql", StringComparison.OrdinalIgnoreCase))
    await db.Database.MigrateAsync();      // Produccion: pipeline de migraciones
else
    await db.Database.EnsureCreatedAsync(); // Tests/dev: SQLite (schema from model)
```

---

## 5. Tablas creadas en PostgreSQL

| Tabla | Origen | Indices principales |
|---|---|---|
| Users | EF Migration | PK, IX_Users_Email (unique), IX_Users_Phone (unique) |
| Memberships | EF Migration | PK, IX_Memberships_UserId_BusinessId (unique) |
| Businesses | EF Migration | PK, IX_Businesses_Name |
| Devices | EF Migration | PK, IX_Devices_BusinessId_Id (unique) |
| DeviceSessions | EF Migration | PK, IX_DeviceSessions_RefreshTokenHash |
| OrganizationSequence | EF Migration | PK (BusinessId) |
| SyncBatches | EF Migration | PK (BusinessId, RequestId) |
| Products | EF Migration | PK (BusinessId, Id), IX_Products_BusinessId_Seq, IX_Products_BusinessId_UpdatedAt |
| Customers | EF Migration | PK (BusinessId, Id), IX_Customers_BusinessId_Seq, IX_Customers_BusinessId_UpdatedAt |
| Providers | EF Migration | PK (BusinessId, Id), IX_Providers_BusinessId_Seq, IX_Providers_BusinessId_UpdatedAt |
| Orders | EF Migration | PK (BusinessId, Id), IX_Orders_BusinessId_Seq, IX_Orders_BusinessId_Status, IX_Orders_BusinessId_Number (unique) |
| StockMovements | EF Migration | PK (Id), IX_StockMovements_BusinessId_Seq |
| CashRegister | EF Migration | PK (Id) |
| CashClosures | EF Migration | PK (Id), IX_CashClosures_BusinessId_Seq |
| Backups | EF Migration | PK (Id), IX_Backups_BusinessId_Id (unique) |
| audit_log | SQL (E3) | PK (id), IX_audit_log_user_id, IX_audit_log_business_id, IX_audit_log_created_at, IX_audit_log_business_event |
| __EFMigrationsHistory | EF Migration | PK (MigrationId) |

---

## 6. Hardening host aplicado

### Configuracion por entorno

**appsettings.json** (Development):
```json
{
  "ConnectionStrings": {
    "Vendelo": "Host=127.0.0.1;Port=5432;Database=vendelo;Username=postgres;"
  },
  "Database": {
    "Provider": "Npgsql"
  },
  "Jwt__Key": "vendelo-dev-only-key-please-rotate-in-prod-0123456789abcdef",
  "Jwt__Issuer": "vendelo-api",
  "Jwt__Audience": "vendelo-app"
}
```

**appsettings.Production.json** (Production):
```json
{
  "ConnectionStrings": {
    "Vendelo": "Host=127.0.0.1;Port=5432;Database=vendelo;Username=postgres;"
  },
  "Database": {
    "Provider": "Npgsql"
  },
  "Jwt__Key": "<ROTAR_A_CLAVE_REAL>",
  "Jwt__Issuer": "vendelo-api",
  "Jwt__Audience": "vendelo-app"
}
```

### Logging
- 500 errores se logean via `ILogger` (mejorado en F4.1, previo `Console.Error`)
- `ApiErrorHandlingMiddleware` envelope: `{error:{code,message,requestId,details}}`
- No se loguean cuerpos, tokens ni contrasenas

### Tokens (sin cambios, F4.1 ya completo)
- JWT 15 min con `jti` + `cep`; refresh opaco rotativo (48 h activo, 30 d absoluto, hash BD)
- Reuso refresh → 409 `TOKEN_REUSE`; `changeEpoch` revoca todas las sesiones
- Igualacion temporal en login (dummy hash contra usuario inexistente)

### Audit log (E3 — nuevo en F5)
- Tabla `audit_log` creada: id, user_id, business_id, event, meta, created_at
- Indices: user_id, business_id, created_at, (business_id, event)
- Integracion completa en endpoints: F6 (registrar eventos: register, change-password, restore, revoke, logout)

---

## 7. Items diferidos (anotaciones F5)

| ID | Item | Prioridad | Destino |
|---|---|---|---|
| E1 | Rate limiter in-memory → Redis/store distribuido | Alta | F6 (multi-dispositivo requiere esto) |
| E2 | `stock.view` sin consumidor; permisos lectura devices/capabilities | Baja | F6 (decision) |
| E3 | Audit log tabla creada; integracion en endpoints | Media | F6 (registrar eventos) |
| E4 | Recovery endpoint PARTE 20 (placeholder) — requiere canal email/SMS | Baja | F7 (cuenta cliente) |
| E5 | Paginacion GET /orders (Take 500 sin cursor); snapshot pull sin paginar | Media | F7 |

### No implementables en F5 (sin Docker/Redis disponible)
- Rate limiter distribuido (E1): requiere Redis o store compartido. En memoria es aceptable para single-instance.
- Migraciones multi-instancia: el limiter in-memory no sincroniza entre instancias.

---

## 8. Recomendaciones produccion

1. **Contrasena PostgreSQL:** Cambiar de trust a scram-sha-256. Establecer contrasena real para `postgres` y actualizar connection string.
2. **JWT Key:** Rotar `vendelo-dev-only-key...` por una clave real de 32+ bytes (env var `Jwt__Key`). Nunca en repo.
3. **Connection string:** En produccion usar `Host=IP_servidor;Port=5432;Database=vendelo;Username=vendelo_app;Password=...` con usuario dedicado (no postgres).
4. **SSL:** Habilitar `SslMode=Require` en connection string para conexiones encriptadas.
5. **Backup DB:** `pg_dump -h host -U user -d vendelo > backup.sql` — programar diariamente.
6. **Migraciones CI/CD:** Incorporar `dotnet ef database update` en el pipeline de deploy (despues de `dotnet publish`).
7. **Firewall:** Restringir acceso a puerto 5432 solo a IPs de aplicacion.
8. **Audit log:** Implementar registro de eventos sensibles en la tabla audit_log (F6).

---

## 9. Archivos creados/modificados en F5

| Archivo | Accion | Contenido |
|---|---|---|
| `backend/src/Vendelo.Api/appsettings.json` | Modificado | Añadido ConnectionStrings + Database:Provider + JWT config |
| `backend/src/Vendelo.Api/appsettings.Production.json` | Creado | Config produccion con PostgreSQL |
| `backend/src/Vendelo.Api/Program.cs` | Modificado | MigrateAsync (Npgsql) / EnsureCreatedAsync (SQLite) |
| `backend/src/Vendelo.Api/Migrations/20260922002720_InitialCreate.cs` | Creado | Migracion EF inicial (15 tablas) |
| `backend/src/Vendelo.Api/Migrations/VendeloDbContextModelSnapshot.cs` | Creado | Snapshot del modelo |
| `backend/deploy/001_create_audit_log.sql` | Creado | Tabla audit_log + indices |
| `backend/deploy/deploy.ps1` | Creado | Script de despliegue |
| `docs/INFORME-F5.md` | creado | Este informe |

---

## 10. Estado de la secuencia

F1 · F1.1 · F2 · F2.1 · F2.2 · F2.2-B · F3 · F3.1 · F4 · F4.1 · **F5** — pendientes: **F5.1** (conectar cliente RN ↔ API), luego F6+.
