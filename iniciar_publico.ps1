# Abre LITHIO para personas fuera de tu Wi-Fi (gratis, con esta PC encendida).
#
# 1. Enciende el servidor si no lo esta.
# 2. Abre un tunel de Cloudflare: una direccion https publica que llega a esta PC.
# 3. Arranca Expo en modo tunel con esa direccion: el QR sirve desde cualquier red.
#
# La direccion cambia cada vez que se abre; no se toca moto_unc_mobile\.env, asi
# que iniciar_todo.bat sigue funcionando igual para uso en tu Wi-Fi.

$ErrorActionPreference = 'Continue'
$Root = $PSScriptRoot
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
Remove-Item $Log -ErrorAction SilentlyContinue
$tunnel = Start-Process $cloudflared -ArgumentList 'tunnel', '--url', 'http://localhost:8000', '--no-autoupdate', '--logfile', $Log -WindowStyle Hidden -PassThru
$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
  Start-Sleep 1
  if (Test-Path $Log) {
    $m = Select-String -Path $Log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value }
  }
}
if (-not $url) { Write-Host "ERROR: el tunel no dio direccion. Revisa $Log" -ForegroundColor Red; exit 1 }
$ok = $false
for ($i = 0; $i -lt 30 -and -not $ok; $i++) {
  Start-Sleep 2
  try { $ok = (Invoke-RestMethod "$url/health" -TimeoutSec 5).status -eq 'ok' } catch {}
}
if (-not $ok) { Write-Host "Aviso: $url aun no responde; puede tardar unos segundos mas." -ForegroundColor Yellow }
Write-Host "Servidor publico: $url" -ForegroundColor Green

Write-Host '==> 3/3 App en modo tunel (espera el QR)' -ForegroundColor Cyan
# Variable del proceso: tiene prioridad sobre el .env y no lo modifica.
$env:EXPO_PUBLIC_API_URL = $url
Set-Location (Join-Path $Root 'moto_unc_mobile')
try { & npx expo start --tunnel --port 8082 --clear }
finally { Stop-Process -Id $tunnel.Id -Force -ErrorAction SilentlyContinue }
