# Einmalig je Windows-Rechner: PostgreSQL 17 per winget installieren und Nutzer + Datenbank
# für die lokale Entwicklung anlegen. Linux/macOS: scripts/setup-postgres.sh
# Aufruf in PowerShell (als Administrator, wegen Installation + Windows-Dienst):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-postgres.ps1
# Anderer Name/Passwort: $env:DB_USER / $env:DB_PASS / $env:DB_NAME vorher setzen.
# Ohne DB_PASS bekommt ein neuer Nutzer ein Zufallspasswort; die fertige DATABASE_URL-Zeile für .env steht am Ende.
# Datei als UTF-8 MIT BOM speichern: Windows PowerShell 5.1 liest sie sonst als Windows-1252. In Zeichenketten keine
# typografischen Zeichen (Gedankenstrich, Anführungszeichen unten/oben): ohne BOM beenden deren Bytes die Zeichenkette.
$ErrorActionPreference = "Stop"
$DbUser = if ($env:DB_USER) { $env:DB_USER } else { "kreiswerts" }
$DbName = if ($env:DB_NAME) { $env:DB_NAME } else { "kreiswerts" }
$Generated = -not $env:DB_PASS
$DbPass = if ($Generated) {
  $Bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($Bytes)
  -join ($Bytes | ForEach-Object { $_.ToString("x2") })
} else { $env:DB_PASS }
# Windows PowerShell 5.1 reicht Anführungszeichen und Leerzeichen in Argumenten für psql.exe verfälscht weiter (aus a"b
# würde still ab) → eigene Werte nur aus Zeichen, die unverändert ankommen. Das Zufallspasswort erfüllt das immer.
# -cnotmatch und \A…\z statt -notmatch und ^…$: ohne Beachtung der Groß-/Kleinschreibung träfe [A-Za-z] auch einzelne
# Sonderzeichen (Kelvin-Zeichen), und $ passt auch vor einem Zeilenumbruch am Ende.
if ($DbUser -cnotmatch '\A[A-Za-z_][A-Za-z0-9_]{0,62}\z') { throw "DB_USER: nur Buchstaben, Ziffern und _ erlaubt" }
if ($DbName -cnotmatch '\A[A-Za-z_][A-Za-z0-9_]{0,62}\z') { throw "DB_NAME: nur Buchstaben, Ziffern und _ erlaubt" }
if ($DbPass -cnotmatch '\A[A-Za-z0-9_.~-]+\z') { throw "DB_PASS: nur Buchstaben, Ziffern und _ . ~ - erlaubt" }
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

# Name und Passwort gehen als psql-Variablen hinein (:'name' = Text, :"name" = Bezeichner), nie in den SQL-Text:
# so kann ein Sonderzeichen darin kein SQL einschleusen. psql ersetzt Variablen nur in SQL von stdin, nicht bei -c.
# Das Passwort kommt als \set-Zeile über die Eingabe, nie als Argument: Argumente stehen in der Prozessliste und, wenn
# Windows Prozessstarts protokolliert, dauerhaft im Ereignis-Log. Maskieren ist nicht nötig: die Prüfung oben lässt nur
# Zeichen zu, die psql in einfachen Anführungszeichen unverändert übernimmt.
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
    # Die drei SET-Zeilen gelten nur für diese Sitzung: scheitert CREATE ROLE (z. B. reservierter Name) oder loggt der
    # Server alle Anweisungen, stünde die Anweisung sonst samt Passwort im PostgreSQL-Log.
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
  # Auch nach einem Fehler: das Superuser-Passwort bleibt nicht in der Umgebung dieser PowerShell-Sitzung
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

if ($RoleExists) {
  Write-Host "PostgreSQL bereit: postgres://${DbUser}:***@localhost:5432/$DbName (Nutzer bestand schon, Passwort unverändert)"
  Write-Host "Vor dem 2026-11-26 eingerichtet? Dann gilt noch das alte, öffentlich bekannte Standardpasswort. Passwort wechseln: README, Abschnitt Lokal starten"
} elseif ($Generated) {
  Write-Host "PostgreSQL bereit. Diese Zeile in .env eintragen (das Passwort wird nur jetzt angezeigt):"
  Write-Host "DATABASE_URL=postgres://${DbUser}:${DbPass}@localhost:5432/$DbName"
} else {
  Write-Host "PostgreSQL bereit: postgres://${DbUser}:***@localhost:5432/$DbName"
}
