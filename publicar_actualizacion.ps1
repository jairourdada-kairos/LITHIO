# Publica los cambios de la app (pantallas, textos, lógica) para todos los APK
# instalados, sin compilar uno nuevo (EAS Update).
#
# Uso: doble clic en publicar_actualizacion.bat y escribe qué cambió.
# Cada teléfono la descarga al abrir la app y la aplica la siguiente vez que se abre.
#
# Si el cambio es nativo (permiso nuevo, módulo nativo, ícono o nombre de la app),
# esto no alcanza: sube "version" en moto_unc_mobile\app.json, genera un APK con
# generar_apk.bat y fija APP_MIN_BUILD en el .env del servidor.

# 'Continue': en PowerShell 5.1, con 'Stop' los avisos de npx en stderr detienen el script.
$ErrorActionPreference = 'Continue'
Set-Location (Join-Path $PSScriptRoot 'moto_unc_mobile')

$message = Read-Host 'Que cambio en esta actualizacion? (ej. "Nuevo diseno de la billetera")'
if (-not $message) { $message = 'Mejoras de LITHIO' }

Write-Host ''
Write-Host '==> Publicando la actualizacion (1-3 minutos)' -ForegroundColor Cyan
& npx -y 'eas-cli@latest' update --channel preview --environment preview --message $message --non-interactive
if ($LASTEXITCODE -ne 0) { Write-Host 'ERROR: no se pudo publicar la actualizacion.' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host 'LISTO: los APK instalados recibiran el cambio la proxima vez que se abran.' -ForegroundColor Green
