# Once per Windows machine: install PostgreSQL 17 via winget and create user + database
# for local development. Linux/macOS: scripts/setup-postgres.sh
# Run in PowerShell (as administrator, because of the installation + Windows service):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-postgres.ps1
# Anderer Name/Passwort: $env:DB_USER / $env:DB_PASS / $env:DB_NAME vorher setzen.
# Without DB_PASS a new user gets a random password; the finished DATABASE_URL line for .env is printed at the end.
# Save this file as UTF-8 WITH BOM: otherwise Windows PowerShell 5.1 reads it as Windows-1252. No typographic
# characters in strings (dashes, curly quotes): without a BOM their bytes end the string.
$ErrorActionPreference = "Stop"
$DbUser = if ($env:DB_USER) { $env:DB_USER } else { "kreiswerts" }
$DbName = if ($env:DB_NAME) { $env:DB_NAME } else { "kreiswerts" }
$Generated = -not $env:DB_PASS
$DbPass = if ($Generated) {
  $Bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($Bytes)
  -join ($Bytes | ForEach-Object { $_.ToString("x2") })
} else { $env:DB_PASS }
# Windows PowerShell 5.1 passes quotes and spaces in arguments to psql.exe altered (a"b silently
# becomes ab) → custom values only from characters that arrive unchanged. The random password always meets this.
# -cnotmatch and \A…\z instead of -notmatch and ^…$: case-insensitive, [A-Za-z] would also match some
# special characters (Kelvin sign), and $ also matches before a trailing line break.
if ($DbUser -cnotmatch '\A[A-Za-z_][A-Za-z0-9_]{0,62}\z') { throw "DB_USER: only letters, digits and _ allowed" }
if ($DbName -cnotmatch '\A[A-Za-z_][A-Za-z0-9_]{0,62}\z') { throw "DB_NAME: only letters, digits and _ allowed" }
if ($DbPass -cnotmatch '\A[A-Za-z0-9_.~-]+\z') { throw "DB_PASS: only letters, digits and _ . ~ - allowed" }
$PgBin = "C:\Program Files\PostgreSQL\17\bin"
$Psql = Join-Path $PgBin "psql.exe"

# Password of the superuser 'postgres': set it on a fresh install, otherwise enter the existing one
$Secure = Read-Host "Password for the PostgreSQL superuser 'postgres'" -AsSecureString
$SuperPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure))

if (-not (Test-Path $Psql)) {
  winget install --exact --id PostgreSQL.PostgreSQL.17 --accept-source-agreements --accept-package-agreements `
    --override "--mode unattended --unattendedmodeui none --superpassword `"$SuperPass`" --serverport 5432"
}
Start-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue

# Name and password go in as psql variables (:'name' = text, :"name" = identifier), never into the SQL text:
# so a special character in them cannot inject SQL. psql substitutes variables only in SQL from stdin, not with -c.
# The password comes as a \set line via stdin, never as an argument: arguments show up in the process list and, if
# Windows logs process starts, permanently in the event log. No escaping needed: the check above only allows
# characters that psql takes over unchanged inside single quotes.
function Invoke-Psql([string]$Sql) {
  $Output = "\set db_pass '$DbPass'`n$Sql" | & $Psql -X -qtA -w -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 `
    -v "db_user=$DbUser" -v "db_name=$DbName"
  if ($LASTEXITCODE -ne 0) { throw "psql fehlgeschlagen (Exit-Code $LASTEXITCODE)" }
  $Output
}

$env:PGPASSWORD = $SuperPass
try {
  $RoleExists = (Invoke-Psql "SELECT 1 FROM pg_roles WHERE rolname = :'db_user'") -eq "1"
  if (-not $RoleExists) {
    # The three SET lines apply to this session only: if CREATE ROLE fails (e.g. reserved name) or the server logs
    # all statements, the statement including the password would otherwise end up in the PostgreSQL log.
    Invoke-Psql @'
SET log_statement = 'none';
SET log_min_error_statement = 'panic';
SET log_min_duration_statement = -1;
CREATE ROLE :"db_user" LOGIN PASSWORD :'db_pass';
'@ | Out-Null
  }
  if ((Invoke-Psql "SELECT 1 FROM pg_database WHERE datname = :'db_name'") -ne "1") {
    Invoke-Psql 'CREATE DATABASE :"db_name" OWNER :"db_user";' | Out-Null
  }
} finally {
  # Even after an error: the superuser password does not stay in the environment of this PowerShell session
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

if ($RoleExists) {
  Write-Host "PostgreSQL ready: postgres://${DbUser}:***@localhost:5432/$DbName (user already existed, password unchanged)"
  Write-Host "Set up before 2026-11-26? Then the old, publicly known default password still applies. Change it: README, section Run locally"
} elseif ($Generated) {
  Write-Host "PostgreSQL ready. Put this line into .env (the password is shown only now):"
  Write-Host "DATABASE_URL=postgres://${DbUser}:${DbPass}@localhost:5432/$DbName"
} else {
  Write-Host "PostgreSQL bereit: postgres://${DbUser}:***@localhost:5432/$DbName"
}
