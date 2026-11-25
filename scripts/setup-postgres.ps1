# Einmalig je Windows-Rechner: PostgreSQL 17 per winget installieren und Nutzer + Datenbank
# für die lokale Entwicklung anlegen. Werte passen zu .env.example. Linux/macOS: scripts/setup-postgres.sh
# Aufruf in PowerShell (als Administrator, wegen Installation + Windows-Dienst):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-postgres.ps1
# Anderer Name/Passwort: $env:DB_USER / $env:DB_PASS / $env:DB_NAME vorher setzen.
$ErrorActionPreference = "Stop"
$DbUser = if ($env:DB_USER) { $env:DB_USER } else { "kreiswerts" }
$DbPass = if ($env:DB_PASS) { $env:DB_PASS } else { "kreiswerts" }
$DbName = if ($env:DB_NAME) { $env:DB_NAME } else { "kreiswerts" }
$PgBin = "C:\Program Files\PostgreSQL\17\bin"
$Psql = Join-Path $PgBin "psql.exe"

# Passwort des Superusers „postgres“: bei Neuinstallation festlegen, sonst das bestehende eingeben
$Secure = Read-Host "Passwort für den PostgreSQL-Superuser 'postgres'" -AsSecureString
$SuperPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure))

if (-not (Test-Path $Psql)) {
  winget install --exact --id PostgreSQL.PostgreSQL.17 --accept-source-agreements --accept-package-agreements `
    --override "--mode unattended --unattendedmodeui none --superpassword `"$SuperPass`" --serverport 5432"
}
Start-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue

$env:PGPASSWORD = $SuperPass
function Invoke-Psql([string]$Sql) {
  & $Psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -tAc $Sql
  if ($LASTEXITCODE -ne 0) { throw "psql fehlgeschlagen: $Sql" }
}

if ((Invoke-Psql "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'") -ne "1") {
  Invoke-Psql "CREATE ROLE `"$DbUser`" LOGIN PASSWORD '$DbPass'" | Out-Null
}
if ((Invoke-Psql "SELECT 1 FROM pg_database WHERE datname='$DbName'") -ne "1") {
  Invoke-Psql "CREATE DATABASE `"$DbName`" OWNER `"$DbUser`"" | Out-Null
}
Remove-Item Env:PGPASSWORD
Write-Host "PostgreSQL bereit: postgres://${DbUser}:***@localhost:5432/$DbName"
