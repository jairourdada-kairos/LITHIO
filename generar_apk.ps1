# Genera el instalable de Android (APK) de LITHIO con notificaciones push.
#
# Uso: doble clic en generar_apk.bat.
# La compilacion se hace en los servidores de Expo (EAS), no en esta PC.
# El APK no lleva una direccion fija: al abrirse lee de Firebase la direccion
# que publica iniciar_publico.bat (ver DESPLIEGUE.md, seccion APK).

# 'Continue': en PowerShell 5.1, con 'Stop' los avisos de npx en stderr detienen el script.
$ErrorActionPreference = 'Continue'
$Mobile = Join-Path $PSScriptRoot 'moto_unc_mobile'
Set-Location $Mobile

# Parametro con nombre: con @args, el envoltorio npx.ps1 pierde los argumentos.
function Eas {
  param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Rest)
  & npx -y 'eas-cli@latest' @Rest
  if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: eas $($Rest -join ' ') fallo" -ForegroundColor Red; exit 1 }
}

if (-not (Test-Path 'google-services.json')) {
  Write-Host 'ERROR: falta moto_unc_mobile\google-services.json (Firebase para Android).' -ForegroundColor Red
  Write-Host 'Descargalo desde la consola de Firebase: ver DESPLIEGUE.md, seccion APK, paso 1.'
  exit 1
}

Write-Host ''
Write-Host '==> 1/4 Cuenta de Expo' -ForegroundColor Cyan
& npx -y 'eas-cli@latest' whoami 2>$null
if ($LASTEXITCODE -ne 0) { Eas login }

Write-Host ''
Write-Host '==> 2/4 Configuracion de la app (Firebase web y Firebase Android)' -ForegroundColor Cyan
Eas env:push preview --path .env --force
Eas env:create preview --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --force --non-interactive

Write-Host ''
Write-Host '==> 3/4 Credencial de notificaciones (FCM V1)' -ForegroundColor Cyan
$answer = Read-Host 'Ya subiste antes la clave FCM V1 a Expo? (s/n)'
if ($answer -notmatch '^[sS]') {
  Write-Host 'En el menu que se abre elige: Android > preview > Google Service Account >'
  Write-Host '"Manage your Google Service Account Key for Push Notifications (FCM V1)" > Upload,'
  Write-Host 'y selecciona el archivo JSON de la cuenta de servicio de Firebase (C:\secure\...).'
  & npx -y 'eas-cli@latest' credentials --platform android
}

Write-Host ''
Write-Host '==> 4/4 Compilar el APK (unos 15 minutos; la primera vez acepta crear la firma de Android)' -ForegroundColor Cyan
Eas build --platform android --profile preview

Write-Host ''
Write-Host 'LISTO: arriba esta el enlace para descargar el .apk.' -ForegroundColor Green
Write-Host 'Compartelo por WhatsApp; al instalar, Android pedira permitir "origenes desconocidos".'
Write-Host 'Recuerda: el APK funciona mientras iniciar_publico.bat este abierto en esta PC.'
