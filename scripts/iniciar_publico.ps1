# Abre LITHIO para personas fuera de tu Wi-Fi (gratis, con esta PC encendida).
#
# 1. Enciende el servidor si no lo esta.
# 2. Abre un tunel de Cloudflare: una direccion https publica que llega a esta PC.
# 3. Abre otro tunel para la app (Expo) y arranca Expo: el QR sirve desde cualquier red.
#
# La direccion cambia cada vez que se abre; no se toca lithio_mobile\.env, asi
# que iniciar_todo.bat sigue funcionando igual para uso en tu Wi-Fi.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Log = Join-Path $env:TEMP 'lithio-tunel.log'

$cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
foreach ($candidate in "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe") {
  if (-not $cloudflared -and (Test-Path $candidate)) { $cloudflared = $candidate }
}
if (-not $cloudflared) { Write-Host 'ERROR: falta cloudflared. Instala con: winget install Cloudflare.cloudflared' -ForegroundColor Red; exit 1 }

Write-Host '==> 1/3 Servidor' -ForegroundColor Cyan
try { Invoke-RestMethod 'http://127.0.0.1:8000/health' -TimeoutSec 3 | Out-Null; Write-Host 'Ya estaba encendido.' }
catch {
  Start-Process cmd -ArgumentList '/c', "`"$Root\iniciar_servidor.bat`"" -WindowStyle Minimized
  $up = $false
  for ($i = 0; $i -lt 30 -and -not $up; $i++) {
    Start-Sleep 1
    try { Invoke-RestMethod 'http://127.0.0.1:8000/health' -TimeoutSec 2 | Out-Null; $up = $true } catch {}
  }
  if (-not $up) { Write-Host 'ERROR: el servidor no arranco. Abre iniciar_servidor.bat para ver el error.' -ForegroundColor Red; exit 1 }
  Write-Host 'Encendido (ventana minimizada "Servidor LITHIO").'
}

Write-Host '==> 2/3 Tunel publico de Cloudflare' -ForegroundColor Cyan
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force

# Abre un tunel rapido de Cloudflare hacia un puerto local y devuelve su direccion https.
function Start-Tunnel($port, $log) {
  Remove-Item $log -ErrorAction SilentlyContinue
  $proc = Start-Process $cloudflared -ArgumentList 'tunnel', '--url', "http://localhost:$port", '--no-autoupdate', '--logfile', $log -WindowStyle Hidden -PassThru
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep 1
    if (Test-Path $log) {
      $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
      if ($m) { return @{ Url = $m.Matches[0].Value; Process = $proc } }
    }
  }
  Write-Host "ERROR: el tunel del puerto $port no dio direccion. Revisa $log" -ForegroundColor Red
  exit 1
}

$api = Start-Tunnel 8000 $Log
$url = $api.Url
$ok = $false
for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
  Start-Sleep 2
  try { $ok = (Invoke-RestMethod "$url/health" -TimeoutSec 5).status -eq 'ok' } catch {}
}
if (-not $ok) { Write-Host "Aviso: $url aun no responde; puede tardar unos segundos mas." -ForegroundColor Yellow }
Write-Host "Servidor publico: $url" -ForegroundColor Green

# El APK lee esta direccion desde Firebase al abrirse (cambia en cada arranque).
Push-Location (Join-Path $Root 'lithio_backend')
& .\venv\Scripts\python.exe -m app.publish_address $url
if ($LASTEXITCODE -ne 0) { Write-Host 'Aviso: el APK no sabra la direccion nueva hasta configurar Firestore (ver docs/DESPLIEGUE.md).' -ForegroundColor Yellow }
Pop-Location

# La app tambien sale por Cloudflare (https). El tunel de Expo fallaba: se caia
# con error 409 y redirigia de http a https, y algunos telefonos no lo cargaban.
Write-Host '==> 3/3 App por Cloudflare (espera el QR)' -ForegroundColor Cyan
$metro = Start-Tunnel 8082 (Join-Path $env:TEMP 'lithio-tunel-app.log')
$appUrl = $metro.Url
$expUrl = $appUrl -replace '^https://', 'exps://'

# Google y Facebook solo inician sesion en la web desde dominios autorizados en Firebase.
Push-Location (Join-Path $Root 'lithio_backend')
& .\venv\Scripts\python.exe -m app.authorize_domain $appUrl
if ($LASTEXITCODE -ne 0) { Write-Host 'Aviso: en la web, Google no funcionara hasta autorizar este dominio en Firebase.' -ForegroundColor Yellow }
Pop-Location

# Variables del proceso: tienen prioridad sobre el .env y no lo modifican.
$env:EXPO_PUBLIC_API_URL = $url
$env:EXPO_PACKAGER_PROXY_URL = $appUrl
Write-Host ''
Write-Host "Direccion para Expo Go (escanea el QR o escribela en Expo Go):" -ForegroundColor Green
Write-Host "  $expUrl" -ForegroundColor Green
Write-Host ''
Set-Location (Join-Path $Root 'lithio_mobile')
try { & npx expo start --lan --port 8082 --clear }
finally {
  Stop-Process -Id $api.Process.Id -Force -ErrorAction SilentlyContinue
  Stop-Process -Id $metro.Process.Id -Force -ErrorAction SilentlyContinue
}
