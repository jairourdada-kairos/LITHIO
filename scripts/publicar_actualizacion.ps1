# Publica los cambios de la app (pantallas, textos, lógica) para todos los APK
# instalados, sin compilar uno nuevo (EAS Update).
#
# Uso: doble clic en publicar_actualizacion.bat y escribe qué cambió.
# Cada teléfono la descarga al abrir la app y se reinicia solo con los cambios.
# Antes de publicar sube el .env de la app a Expo, así llegan las claves nuevas
# (por ejemplo EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).
#
# Si el cambio es nativo (permiso nuevo, módulo nativo, ícono o nombre de la app),
# esto no alcanza: sube "version" en lithio_mobile\app.json, genera un APK con
# generar_apk.bat y fija APP_MIN_BUILD en el .env del servidor.

# 'Continue': en PowerShell 5.1, con 'Stop' los avisos de npx en stderr detienen el script.
$ErrorActionPreference = 'Continue'
Set-Location (Join-Path (Split-Path -Parent $PSScriptRoot) 'lithio_mobile')

$message = Read-Host 'Que cambio en esta actualizacion? (ej. "Nuevo diseno de la billetera")'
if (-not $message) { $message = 'Mejoras de LITHIO' }

Write-Host ''
Write-Host '==> Subiendo la configuracion de la app (.env) a Expo' -ForegroundColor Cyan
& npx -y 'eas-cli@latest' env:push preview --path .env --force
if ($LASTEXITCODE -ne 0) { Write-Host 'ERROR: no se pudo subir el .env a Expo.' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '==> Publicando la actualizacion (1-3 minutos)' -ForegroundColor Cyan
& npx -y 'eas-cli@latest' update --channel preview --environment preview --message $message --non-interactive
if ($LASTEXITCODE -ne 0) { Write-Host 'ERROR: no se pudo publicar la actualizacion.' -ForegroundColor Red; exit 1 }

Write-Host ''
# La version web (iPhone y computadoras) tambien se actualiza.
& (Join-Path $PSScriptRoot 'exportar_web.ps1')

Write-Host ''
Write-Host 'LISTO: los APK instalados recibiran el cambio al abrir LITHIO, y la web ya muestra la version nueva.' -ForegroundColor Green
