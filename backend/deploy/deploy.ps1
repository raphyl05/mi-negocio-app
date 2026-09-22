# Vendelo App — F5 Deployment Script
# Despliegue en PostgreSQL local (desarrollo) o remoto (produccion).
# Requiere: dotnet 10, PostgreSQL 17, Npgsql connection string.

param(
    [string]$ConnectionString = "Host=127.0.0.1;Port=5432;Database=vendelo;Username=postgres;Password=;",
    [string]$DatabaseProvider = "Npgsql",
    [string]$JwtKey = "",
    [switch]$SkipMigration = $false
)

$ErrorActionPreference = "Stop"
$baseDir = Split-Path $PSScriptRoot -Parent
$srcDir = Join-Path $baseDir "src\Vendelo.Api"

Write-Host "=== Vendelo App — F5 Deployment ===" -ForegroundColor Cyan

# 1. Build
Write-Host "`n[1/4] Building..." -ForegroundColor Yellow
dotnet build (Join-Path $srcDir "Vendelo.Api.csproj") | Out-Default

# 2. Create database if not exists (via psql if available)
Write-Host "`n[2/4] Checking database..." -ForegroundColor Yellow
$dbName = "vendelo"
$match = [regex]::Match($ConnectionString, "Database=([^;]+)")
if ($match.Success) { $dbName = $match.Groups[1].Value }

# 3. Apply EF migrations
if (-not $SkipMigration) {
    Write-Host "`n[3/4] Applying migrations..." -ForegroundColor Yellow
    dotnet ef database update --project (Join-Path $srcDir "Vendelo.Api.csproj") | Out-Default
} else {
    Write-Host "`n[3/4] Skipping migrations (--SkipMigration)" -ForegroundColor Yellow
}

# 4. Create audit_log table if not exists
Write-Host "`n[4/4] Creating audit_log table..." -ForegroundColor Yellow
$psql = Get-Command psql -ErrorAction SilentlyContinue
if ($psql) {
    $auditSql = @"
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL,
    business_id VARCHAR(64),
    event VARCHAR(64) NOT NULL,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS IX_audit_log_user_id ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS IX_audit_log_business_id ON audit_log (business_id);
CREATE INDEX IF NOT EXISTS IX_audit_log_created_at ON audit_log (created_at);
CREATE INDEX IF NOT EXISTS IX_audit_log_business_event ON audit_log (business_id, event);
"@
    $auditSql | psql -h 127.0.0.1 -p 5432 -U postgres -d $dbName 2>&1 | Out-Default
} else {
    Write-Host "psql not found. Create audit_log manually." -ForegroundColor Yellow
}

Write-Host "`n=== Deployment complete ===" -ForegroundColor Green
Write-Host "Connection: $ConnectionString" -ForegroundColor Gray
Write-Host "Provider: $DatabaseProvider" -ForegroundColor Gray
Write-Host "JWT Key: $(if ($JwtKey) { 'configured' } else { 'MISSING - set JwtKey' })" -ForegroundColor $(if ($JwtKey) { "Green" } else { "Red" })
