# Prepara la versión web de LITHIO (la que abren los iPhone y las computadoras).
#
# Compila la app en modo producción (más liviana y rápida que la de Expo en
# desarrollo) en lithio_mobile\dist-web. El servidor la sirve en /app, en la
# misma dirección que la API: un solo link para todos, sin depender de Expo.
#
# Lo llaman iniciar_publico.bat (si aún no existe) y publicar_actualizacion.bat
# (después de cada cambio de la app). Tarda 1-2 minutos.

$ErrorActionPreference = 'Continue'
Set-Location (Join-Path (Split-Path -Parent $PSScriptRoot) 'lithio_mobile')

Write-Host '==> Compilando la version web (1-2 minutos)' -ForegroundColor Cyan
$env:EXPO_WEB_BASE_URL = '/app'
& npx expo export --platform web --output-dir dist-web --clear
$code = $LASTEXITCODE
Remove-Item Env:EXPO_WEB_BASE_URL
if ($code -ne 0) { Write-Host 'ERROR: no se pudo compilar la version web.' -ForegroundColor Red; exit 1 }
Write-Host 'Version web lista: el servidor la muestra en /app.' -ForegroundColor Green
