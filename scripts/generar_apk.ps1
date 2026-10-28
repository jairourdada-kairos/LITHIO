# Genera el instalable de Android (APK) de LITHIO con notificaciones push.
#
# Uso: doble clic en generar_apk.bat.
# La compilacion se hace en los servidores de Expo (EAS), no en esta PC.
# El APK no lleva una direccion fija: al abrirse lee de Firebase la direccion
# que publica iniciar_publico.bat (ver docs/DESPLIEGUE.md, seccion APK).

# 'Continue': en PowerShell 5.1, con 'Stop' los avisos de npx en stderr detienen el script.
$ErrorActionPreference = 'Continue'
$Mobile = Join-Path (Split-Path -Parent $PSScriptRoot) 'lithio_mobile'
Set-Location $Mobile

# Parametro con nombre: con @args, el envoltorio npx.ps1 pierde los argumentos.
function Eas {
  param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Rest)
  & npx -y 'eas-cli@latest' @Rest
  if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: eas $($Rest -join ' ') fallo" -ForegroundColor Red; exit 1 }
}

if (-not (Test-Path 'google-services.json')) {
  Write-Host 'ERROR: falta lithio_mobile\google-services.json (Firebase para Android).' -ForegroundColor Red
  Write-Host 'Descargalo desde la consola de Firebase: ver docs/DESPLIEGUE.md, seccion APK, paso 1.'
  exit 1
}

Write-Host ''
Write-Host '==> 1/3 Cuenta de Expo' -ForegroundColor Cyan
& npx -y 'eas-cli@latest' whoami 2>$null
if ($LASTEXITCODE -ne 0) { Eas login }

Write-Host ''
Write-Host '==> 2/3 Configuracion de la app (Firebase web y Firebase Android)' -ForegroundColor Cyan
Eas env:push preview --path .env --force
Eas env:create preview --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --force --non-interactive

Write-Host ''
Write-Host '==> 3/3 Compilar el APK (unos 15 minutos)' -ForegroundColor Cyan
# Sin preguntas: la primera vez Expo crea y guarda la firma de Android.
# Las notificaciones salen directo por Firebase desde el servidor: no hay que subir claves a Expo.
Eas build --platform android --profile preview --non-interactive

Write-Host ''
Write-Host 'LISTO: arriba esta el enlace para descargar el .apk.' -ForegroundColor Green
Write-Host 'Compartelo por WhatsApp; al instalar, Android pedira permitir "origenes desconocidos".'
Write-Host 'Recuerda: el APK funciona mientras iniciar_publico.bat este abierto en esta PC.'
