# Despliega el backend de LITHIO en Railway (servidor 24/7, sin depender de esta PC).
#
# Uso: doble clic en desplegar_nube.bat  (o: powershell -ExecutionPolicy Bypass -File scripts\desplegar_nube.ps1)
#
# Lo unico manual es iniciar sesion en Railway en el navegador. Los secretos
# (claves de cifrado y cuenta de servicio de Firebase) se leen de esta PC y se
# envian directo a Railway; el script nunca los muestra en pantalla.
# Se puede ejecutar de nuevo: reutiliza lo que ya exista y vuelve a desplegar.

# 'Continue': en PowerShell 5.1, con 'Stop' cualquier aviso que un programa
# escribe en stderr detiene el script. Los fallos se detectan con $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root 'lithio_backend'
$Mobile = Join-Path $Root 'lithio_mobile'
$Service = 'lithio-api'

function Step($text) { Write-Host ''; Write-Host "==> $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host ''; Write-Host "ERROR: $text" -ForegroundColor Red; exit 1 }
# Parametro con nombre: con @args, el envoltorio npx.ps1 pierde los argumentos.
function Railway {
  param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Rest)
  & npx -y '@railway/cli@latest' @Rest
  if ($LASTEXITCODE -ne 0) { throw "railway $($Rest -join ' ') fallo" }
}
function RailwayOut {
  param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Rest)
  $out = & npx -y '@railway/cli@latest' @Rest 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($out -join "`n") }
  return ($out -join "`n")
}

function Read-DotEnv($path) {
  $values = @{}
  foreach ($line in Get-Content $path -Encoding UTF8) {
    if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$') { $values[$Matches[1]] = $Matches[2].Trim('"') }
  }
  return $values
}

Set-Location $Root
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { Fail 'No se encontro Node.js (npx). Instala Node.js LTS desde nodejs.org.' }
$envFile = Join-Path $Backend '.env'
if (-not (Test-Path $envFile)) { Fail "No existe $envFile" }
$cfg = Read-DotEnv $envFile
foreach ($key in 'LITHIO_ENCRYPTION_KEYS', 'LITHIO_HASH_KEY', 'FIREBASE_PROJECT_ID') {
  if (-not $cfg[$key]) { Fail "Falta $key en lithio_backend\.env" }
}
$saPath = $cfg['FIREBASE_SERVICE_ACCOUNT_PATH']
if (-not $saPath -or -not (Test-Path $saPath)) { Fail 'No se encontro el JSON de la cuenta de servicio de Firebase (FIREBASE_SERVICE_ACCOUNT_PATH en el .env).' }

Step '1/8 Iniciar sesion en Railway (se abre el navegador; si no tienes cuenta, se crea con GitHub)'
$who = & npx -y '@railway/cli@latest' whoami 2>&1
if ($LASTEXITCODE -ne 0) { Railway login } else { Write-Host "Sesion activa: $who" }

Step '2/8 Proyecto LITHIO'
$status = & npx -y '@railway/cli@latest' status 2>&1
if ($LASTEXITCODE -ne 0) { Railway init --name lithio } else { Write-Host 'Proyecto ya vinculado a esta carpeta.' }

$services = RailwayOut service list
$newDatabase = $false
Step '3/8 Base de datos PostgreSQL'
if ($services -notmatch 'Postgres') { Railway add --database postgres; $newDatabase = $true } else { Write-Host 'Ya existe.' }

Step "4/8 Servicio del servidor ($Service)"
if ($services -notmatch [regex]::Escape($Service)) { Railway add --service $Service } else { Write-Host 'Ya existe.' }

if ($newDatabase) {
  $answer = Read-Host 'Copiar a la nube tus usuarios, conductores, viajes y rutas actuales? (s/n)'
  if ($answer -match '^[sS]') {
    Step 'Copiando la base local a PostgreSQL'
    $publicUrl = $null
    for ($i = 0; $i -lt 30 -and -not $publicUrl; $i++) {
      $kv = & npx -y '@railway/cli@latest' variable list --service Postgres --kv 2>$null
      $line = $kv | Where-Object { $_ -like 'DATABASE_PUBLIC_URL=*' } | Select-Object -First 1
      if ($line) { $publicUrl = $line.Substring('DATABASE_PUBLIC_URL='.Length) } else { Start-Sleep 5 }
    }
    if (-not $publicUrl) { Fail 'La base de datos no estuvo lista a tiempo. Ejecuta el script de nuevo.' }
    Start-Sleep 10  # La base acepta conexiones unos segundos despues de crearse
    $env:DATABASE_URL = $publicUrl
    Push-Location $Backend
    try { & .\venv\Scripts\python.exe -m app.migrate_to_cloud lithio.db } finally { Pop-Location; Remove-Item Env:DATABASE_URL }
  }
}

Step '5/8 Variables del servidor (los secretos no se muestran)'
$vars = @(
  'APP_ENV=production',
  'PORT=8000',  # Debe coincidir con el puerto del dominio (paso 7)
  'DATABASE_URL=${{Postgres.DATABASE_URL}}',
  'MEDIA_DIR=/data/media',
  'EVIDENCE_DIR=/data/evidence',
  'LOG_DIR=/data/logs',
  "FIREBASE_PROJECT_ID=$($cfg['FIREBASE_PROJECT_ID'])",
  "ADMIN_FIREBASE_UIDS=$($cfg['ADMIN_FIREBASE_UIDS'])",
  "ADMIN_EMAILS=$($cfg['ADMIN_EMAILS'])"
)
Railway variable set --service $Service --skip-deploys @vars | Out-Null
# Los secretos van por stdin para que no queden en el historial de comandos.
$cfg['LITHIO_ENCRYPTION_KEYS'] | & npx -y '@railway/cli@latest' variable set --service $Service --skip-deploys --stdin LITHIO_ENCRYPTION_KEYS | Out-Null
$cfg['LITHIO_HASH_KEY'] | & npx -y '@railway/cli@latest' variable set --service $Service --skip-deploys --stdin LITHIO_HASH_KEY | Out-Null
$saJson = (Get-Content $saPath -Raw -Encoding UTF8 | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 10)
$saJson | & npx -y '@railway/cli@latest' variable set --service $Service --skip-deploys --stdin FIREBASE_SERVICE_ACCOUNT_JSON | Out-Null
if ($LASTEXITCODE -ne 0) { Fail 'No se pudieron guardar las variables secretas.' }
Write-Host 'Variables guardadas.'

Step '6/8 Disco permanente para fotos (/data)'
$volumes = RailwayOut volume --service $Service list
if ($volumes -notmatch '/data') { Railway volume --service $Service add --mount-path /data } else { Write-Host 'Ya existe.' }

Step '7/8 Direccion publica (https)'
$domainOut = (& npx -y '@railway/cli@latest' domain list --service $Service 2>&1) -join "`n"
$match = [regex]::Match($domainOut, '[a-z0-9-]+\.up\.railway\.app')
if (-not $match.Success) {
  $domainOut = RailwayOut domain --service $Service --port 8000
  $match = [regex]::Match($domainOut, '[a-z0-9-]+\.up\.railway\.app')
}
if (-not $match.Success) { Fail "No se pudo obtener el dominio. Salida: $domainOut" }
$url = "https://$($match.Value)"
Railway variable set --service $Service --skip-deploys "CORS_ALLOWED_ORIGINS=$url" | Out-Null
Write-Host "Direccion: $url"

Step '8/8 Construir y desplegar (tarda 3-6 minutos)'
Railway up --service $Service --detach
Write-Host 'Esperando a que el servidor responda...'
$ok = $false
for ($i = 0; $i -lt 60 -and -not $ok; $i++) {
  Start-Sleep 10
  try { $health = Invoke-RestMethod "$url/health" -TimeoutSec 8; $ok = $health.status -eq 'ok' } catch { Write-Host -NoNewline '.' }
}
if (-not $ok) { Fail "El servidor no respondio a tiempo. Revisa los registros con: npx @railway/cli logs --service $Service" }

# La app del telefono ahora apunta a la nube.
$mobileEnv = Join-Path $Mobile '.env'
if (Test-Path $mobileEnv) {
  $content = Get-Content $mobileEnv -Encoding UTF8 | ForEach-Object { if ($_ -like 'EXPO_PUBLIC_API_URL=*') { "EXPO_PUBLIC_API_URL=$url" } else { $_ } }
  [IO.File]::WriteAllLines($mobileEnv, $content)
}

Write-Host ''
Write-Host '================ LISTO ================' -ForegroundColor Green
Write-Host "Servidor 24/7:     $url"
Write-Host "Panel de admin:    $url/dashboard"
Write-Host 'La app (lithio_mobile\.env) ya apunta a la nube.'
Write-Host 'Siguiente paso: generar_apk.bat para crear el instalable de Android.'
