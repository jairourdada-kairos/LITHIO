# Pone el APK mas reciente en la pagina de descarga (<servidor>/descargar).
#
# Uso: doble clic en actualizar_descarga.bat. generar_apk.bat lo hace solo al terminar.
# Baja de Expo el ultimo APK de Android ya compilado y lo guarda en
# lithio_descarga\LITHIO.apk: asi el link no caduca (el de Expo vence a los 14 dias).

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Target = Join-Path $Root 'lithio_descarga\LITHIO.apk'
Set-Location (Join-Path $Root 'lithio_mobile')

Write-Host '==> Buscando el ultimo APK en Expo' -ForegroundColor Cyan
$json = & npx -y 'eas-cli@latest' build:list --platform android --status finished --limit 1 --json --non-interactive 2>$null
try { $build = ($json | Out-String | ConvertFrom-Json)[0] } catch { $build = $null }
$url = if ($build) { $build.artifacts.applicationArchiveUrl } else { $null }
if (-not $url) {
  Write-Host 'ERROR: no encontre un APK compilado. Inicia sesion con "npx eas-cli login" o corre generar_apk.bat.' -ForegroundColor Red
  exit 1
}
Write-Host "Compilacion $($build.appBuildVersion) del $($build.completedAt)"

# Se baja a un archivo temporal: si se corta, el APK anterior sigue disponible.
$tmp = "$Target.part"
Invoke-WebRequest $url -OutFile $tmp -UseBasicParsing
if (-not (Test-Path $tmp) -or (Get-Item $tmp).Length -lt 1MB) {
  Write-Host 'ERROR: la descarga fallo.' -ForegroundColor Red
  Remove-Item $tmp -ErrorAction SilentlyContinue
  exit 1
}
Move-Item $tmp $Target -Force

# La pagina descarga desde Expo (mas rapido que el internet de esta PC) mientras
# ese link no venza; despues usa la copia de esta PC.
@{ url = $url; expires = $build.expirationDate; build = $build.appBuildVersion } |
  ConvertTo-Json | Set-Content (Join-Path $Root 'lithio_descarga\apk.json') -Encoding utf8
$mb = [math]::Round((Get-Item $Target).Length / 1MB)
Write-Host "LISTO: APK de $mb MB en la pagina de descarga." -ForegroundColor Green
Write-Host 'Link para compartir: <direccion de iniciar_publico>/descargar' -ForegroundColor Green
